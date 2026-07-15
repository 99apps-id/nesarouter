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
  const id = combo.id.trim();
  const name = combo.name.trim();
  if (!id || !name) {
    return NextResponse.json({ error: "Combo id and name cannot be blank." }, { status: 400 });
  }
  const providerIds = [...new Set(combo.providerIds.filter((providerId) => typeof providerId === "string" && providerId.trim()).map((providerId) => providerId.trim()))];
  if (providerIds.length !== combo.providerIds.length) {
    return NextResponse.json({ error: "Each provider can only appear once in a combo." }, { status: 400 });
  }
  const store = await readStore();
  const normalizedId = id.toLowerCase();
  const normalizedName = name.toLowerCase();
  const identifierCollision = store.combos.some((existing) => {
    if (existing.id.toLowerCase() === normalizedId) return false;
    return (
      existing.id.toLowerCase() === normalizedName ||
      existing.name.toLowerCase() === normalizedId ||
      existing.name.toLowerCase() === normalizedName
    );
  });
  if (identifierCollision) {
    return NextResponse.json({ error: "Combo id and name must be unique and cannot match another combo identifier." }, { status: 409 });
  }
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
    id,
    name,
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
