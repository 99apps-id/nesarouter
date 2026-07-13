import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { Combo } from "@/core/types";
import { deleteCombo, readStore, upsertCombo } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const store = await readStore();
  return NextResponse.json(store.combos);
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const combo = (await request.json()) as Combo & { strategy?: string };
  if (!combo.id || !combo.name || !Array.isArray(combo.providerIds) || combo.providerIds.length === 0) {
    return NextResponse.json({ error: "Combo id, name, and at least one providerId are required." }, { status: 400 });
  }
  const providerIds = [...new Set(combo.providerIds.filter((id) => typeof id === "string" && id.trim()))];
  if (providerIds.length !== combo.providerIds.length) {
    return NextResponse.json({ error: "Each provider can only appear once in a combo." }, { status: 400 });
  }
  const store = await readStore();
  if (providerIds.some((id) => !store.providers.some((provider) => provider.id === id))) {
    return NextResponse.json({ error: "A selected provider no longer exists." }, { status: 400 });
  }
  if (combo.strategy && combo.strategy !== "fallback" && combo.strategy !== "round_robin") {
    return NextResponse.json(
      { error: "Unknown combo strategy. Use fallback or round robin." },
      { status: 400 }
    );
  }
  const normalized: Combo = {
    id: combo.id,
    name: combo.name,
    providerIds,
    strategy: combo.strategy === "round_robin" ? "round_robin" : "fallback"
  };
  await upsertCombo(normalized);
  return NextResponse.json(normalized);
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "Combo id required." }, { status: 400 });
  await deleteCombo(body.id);
  return NextResponse.json({ ok: true });
}
