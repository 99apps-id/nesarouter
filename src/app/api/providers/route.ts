import { NextResponse } from "next/server";
import { finalizeAdminResponse, readAdminJson, requireAdmin } from "@/lib/adminApi";
import { redactProviderForClient } from "@/lib/providerRedact";
import { deleteProvider, readProviderById, readStore, updateProvider } from "@/lib/store";
import { ProviderSchema, DeleteProviderSchema, toProviderConfig } from "@/lib/validation";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/adminAudit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const store = await readStore();
  return finalizeAdminResponse(NextResponse.json(store.providers.map(redactProviderForClient)), request);
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const rl = checkRateLimit(rateLimitKey(request, "provider-write"), 20);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited. Try again later." }, { status: 429 });
  }

  const parsedBody = await readAdminJson(request);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.data;

  const parsed = ProviderSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Validation failed." }, { status: 400 });
  }

  try {
    const saved = await updateProvider(toProviderConfig(parsed.data));
    logAdminAction("provider.create", `Provider "${saved.name}" (${saved.id}) created.`, { providerId: saved.id });
    return finalizeAdminResponse(NextResponse.json(redactProviderForClient(saved)), request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save provider.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const rl = checkRateLimit(rateLimitKey(request, "provider-write"), 20);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited. Try again later." }, { status: 429 });
  }

  const parsedBody = await readAdminJson(request);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.data;

  const parsed = DeleteProviderSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Validation failed." }, { status: 400 });
  }

  try {
    const provider = await readProviderById(parsed.data.id);
    await deleteProvider(parsed.data.id);
    logAdminAction("provider.delete", `Provider "${provider?.name ?? parsed.data.id}" deleted.`, { providerId: parsed.data.id });
    return finalizeAdminResponse(NextResponse.json({ ok: true }), request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete provider.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
