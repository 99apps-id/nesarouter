import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import { ProviderConfig } from "@/core/types";
import { redactProviderForClient } from "@/lib/providerRedact";
import { deleteProvider, readStore, updateProvider } from "@/lib/store";

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
  const provider = (await request.json()) as ProviderConfig;
  if (!provider.id || !provider.name || !provider.baseUrl || !provider.model) {
    return NextResponse.json({ error: "Provider id, name, baseUrl, and model are required." }, { status: 400 });
  }
  const saved = await updateProvider(provider);
  return finalizeAdminResponse(NextResponse.json(redactProviderForClient(saved)), request);
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Provider id required." }, { status: 400 });
  }
  await deleteProvider(body.id);
  return finalizeAdminResponse(NextResponse.json({ ok: true }), request);
}
