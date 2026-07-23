import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import { ProviderConfig } from "@/core/types";
import { redactProviderForClient } from "@/lib/providerRedact";
import { deleteProvider, readProviderById, readStore, updateProvider } from "@/lib/store";
import { ProviderSchema, DeleteProviderSchema } from "@/lib/validation";
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

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ProviderSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Validation failed." }, { status: 400 });
  }

  const saved = await updateProvider(parsed.data as ProviderConfig);
  logAdminAction("provider.create", `Provider "${saved.name}" (${saved.id}) created.`, { providerId: saved.id });
  return finalizeAdminResponse(NextResponse.json(redactProviderForClient(saved)), request);
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = DeleteProviderSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Validation failed." }, { status: 400 });
  }

  const provider = await readProviderById(parsed.data.id);
  await deleteProvider(parsed.data.id);
  logAdminAction("provider.delete", `Provider "${provider?.name ?? parsed.data.id}" deleted.`, { providerId: parsed.data.id });
  return finalizeAdminResponse(NextResponse.json({ ok: true }), request);
}
