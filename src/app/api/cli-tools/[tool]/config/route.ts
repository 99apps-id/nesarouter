import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { publicOrigin } from "@/core/publicUrl";
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

function baseUrlFrom(request: Request, store: Awaited<ReturnType<typeof readStore>>) {
  return publicOrigin(request, store.router.publicBaseUrl);
}

async function buildSetup(
  request: Request,
  tool: string,
  options: { modelTarget: string; createKey: boolean; savePreference: boolean }
) {
  const store = await readStore();
  const toolId = normalizeCliToolId(tool);
  const baseUrl = baseUrlFrom(request, store);
  const resolved = resolveCliModel(store, options.modelTarget);
  let apiKey = "";
  let keyMeta: { id: string; preview: string } | undefined;

  if (options.createKey) {
    apiKey = `nesa_${crypto.randomBytes(24).toString("base64url")}`;
    await addLocalApiKey(apiKey);
    keyMeta = { id: keyId(apiKey), preview: keyPreview(apiKey) };
  } else {
    throw new Error("Buat client key baru dari wizard CLI (key lama tidak bisa ditampilkan ulang).");
  }

  const config = buildCliToolConfig(toolId, baseUrl, apiKey, resolved.model);
  const installScript = buildCliInstallScripts(config);

  if (options.savePreference) {
    await writeStore({
      ...store,
      router: {
        ...store.router,
        cliTools: {
          ...(store.router.cliTools ?? {}),
          [toolId]: { modelTarget: options.modelTarget }
        }
      }
    });
  }

  return {
    tool: toolId,
    baseUrl,
    model: resolved.model,
    modelLabel: resolved.label,
    apiKey,
    key: keyMeta,
    modelTargets: listCliModelTargets(store),
    ...config,
    installScript
  };
}

export async function GET(request: Request, context: { params: Promise<{ tool: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { tool } = await context.params;
  const store = await readStore();
  const url = new URL(request.url);
  const saved = store.router.cliTools?.[normalizeCliToolId(tool)]?.modelTarget;
  const modelTarget = url.searchParams.get("modelTarget") || saved || "auto";

  try {
    const resolved = resolveCliModel(store, modelTarget);
    const baseUrl = baseUrlFrom(request, store);
    const config = buildCliToolConfig(normalizeCliToolId(tool), baseUrl, "<buat key dari wizard>", resolved.model);
    return NextResponse.json({
      tool: normalizeCliToolId(tool),
      baseUrl,
      model: resolved.model,
      modelLabel: resolved.label,
      modelTarget,
      modelTargets: listCliModelTargets(store),
      preview: true,
      ...config,
      installScript: buildCliInstallScripts(config)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat preview config." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ tool: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { tool } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    modelTarget?: string;
    createKey?: boolean;
    savePreference?: boolean;
  };

  try {
    const payload = await buildSetup(request, tool, {
      modelTarget: body.modelTarget ?? "auto",
      createKey: body.createKey !== false,
      savePreference: body.savePreference !== false
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal generate config CLI." },
      { status: 400 }
    );
  }
}
