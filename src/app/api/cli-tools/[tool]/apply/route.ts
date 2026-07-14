import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { publicOrigin } from "@/core/publicUrl";
import { applyCliToolConfigLocal, readCliToolStatus, resetCliToolConfigLocal } from "@/lib/cliLocalApply";
import {
  buildCliInstallScripts,
  buildCliToolConfig,
  listCliModelTargets,
  normalizeCliToolId,
  resolveCliModel
} from "@/lib/cliToolConfig";
import { addLocalApiKey, readStore, writeStore } from "@/lib/store";
import { keyId, keyPreview } from "@/lib/keyIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveApiKey(
  store: Awaited<ReturnType<typeof readStore>>,
  body: { apiKey?: string; keyId?: string; createKey?: boolean }
) {
  if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    const apiKey = body.apiKey.trim();
    return { apiKey, keyMeta: { id: keyId(apiKey), preview: keyPreview(apiKey) }, created: false };
  }
  if (typeof body.keyId === "string" && body.keyId.trim()) {
    const match = store.localApiKeys.find((token) => keyId(token) === body.keyId);
    if (!match) throw new Error("Client key not found. Create a new key or pick an existing one.");
    return { apiKey: match, keyMeta: { id: keyId(match), preview: keyPreview(match) }, created: false };
  }
  if (body.createKey === false) {
    throw new Error("Pick an existing client key, or allow createKey to mint a new one.");
  }
  const apiKey = `nesa_${crypto.randomBytes(24).toString("base64url")}`;
  return { apiKey, keyMeta: { id: keyId(apiKey), preview: keyPreview(apiKey) }, created: true };
}

/** Status of local CLI patch (Connected / Other / Not configured). */
export async function GET(request: Request, context: { params: Promise<{ tool: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { tool } = await context.params;
  const store = await readStore();
  const toolId = normalizeCliToolId(tool);
  const baseUrl = publicOrigin(request, store.router.publicBaseUrl);
  const status = readCliToolStatus(toolId, baseUrl);
  return NextResponse.json({
    tool: toolId,
    baseUrl,
    modelTarget: store.router.cliTools?.[toolId]?.modelTarget ?? "auto",
    ...status
  });
}

/**
 * Apply / patch CLI config on this machine (merge into existing settings).
 * Same idea as 9router Apply — click once, no manual JSON edit.
 */
export async function POST(request: Request, context: { params: Promise<{ tool: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { tool } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    modelTarget?: string;
    createKey?: boolean;
    savePreference?: boolean;
    baseUrl?: string;
    apiKey?: string;
    keyId?: string;
  };

  try {
    const store = await readStore();
    const toolId = normalizeCliToolId(tool);
    const baseUrl =
      (typeof body.baseUrl === "string" && body.baseUrl.trim()) ||
      publicOrigin(request, store.router.publicBaseUrl);
    const resolved = resolveCliModel(store, body.modelTarget ?? "auto");
    const { apiKey, keyMeta, created } = resolveApiKey(store, body);
    if (created) await addLocalApiKey(apiKey);

    const config = buildCliToolConfig(toolId, baseUrl.replace(/\/$/, ""), apiKey, resolved.model);
    const local = applyCliToolConfigLocal(config);
    const status = readCliToolStatus(toolId, baseUrl);

    if (body.savePreference !== false) {
      const latest = await readStore();
      await writeStore({
        ...latest,
        router: {
          ...latest.router,
          cliTools: {
            ...(latest.router.cliTools ?? {}),
            [toolId]: { modelTarget: body.modelTarget ?? "auto" }
          }
        }
      });
    }

    return NextResponse.json({
      ok: true,
      tool: toolId,
      baseUrl: baseUrl.replace(/\/$/, ""),
      model: resolved.model,
      modelLabel: resolved.label,
      // Never echo key again when reusing existing — UI already has it selected.
      apiKey: created ? apiKey : undefined,
      key: keyMeta,
      keyCreated: created,
      modelTargets: listCliModelTargets(store),
      local,
      status,
      installScript: buildCliInstallScripts(config),
      ...config,
      summary: local.skipped
        ? `${config.summary} — this tool has no local file (see instructions).`
        : `Patched on this machine — ${status.configStatus}.`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply/patch CLI config." },
      { status: 400 }
    );
  }
}

/** Reset / unpatch NesaRouter keys from local CLI settings. */
export async function DELETE(request: Request, context: { params: Promise<{ tool: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { tool } = await context.params;
  const toolId = normalizeCliToolId(tool);
  const result = resetCliToolConfigLocal(toolId);
  const store = await readStore();
  const baseUrl = publicOrigin(request, store.router.publicBaseUrl);
  const status = readCliToolStatus(toolId, baseUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.message, status }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: result.message, path: result.path, status });
}
