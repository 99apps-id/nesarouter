import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { Combo } from "@/core/types";
import { deleteCombo, readStore, upsertCombo } from "@/lib/store";
import { ComboSchema } from "@/lib/validation";
import { logAdminAction } from "@/lib/adminAudit";

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

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ComboSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Validation failed." }, { status: 400 });
  }

  const id = parsed.data.id.trim();
  const name = parsed.data.name.trim();
  if (!id || !name) {
    return NextResponse.json({ error: "Combo id and name cannot be blank." }, { status: 400 });
  }
  const providerIds = [...new Set(parsed.data.providerIds.filter((providerId) => providerId.trim()).map((providerId) => providerId.trim()))];
  if (providerIds.length !== parsed.data.providerIds.length) {
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
  if (providerIds.some((providerId) => !store.providers.some((provider) => provider.id === providerId))) {
    return NextResponse.json({ error: "A selected provider no longer exists." }, { status: 400 });
  }
  const normalized: Combo = {
    id,
    name,
    providerIds,
    strategy: parsed.data.strategy === "round_robin" ? "round_robin" : "fallback"
  };
  await upsertCombo(normalized);
  logAdminAction("settings.change", `Combo "${normalized.name}" (${normalized.id}) saved.`, { comboId: normalized.id });
  return NextResponse.json(normalized);
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const id = typeof body === "object" && body && "id" in body ? String((body as { id?: unknown }).id ?? "") : "";
  if (!id) return NextResponse.json({ error: "Combo id required." }, { status: 400 });
  await deleteCombo(id);
  logAdminAction("settings.change", `Combo "${id}" deleted.`, { comboId: id });
  return NextResponse.json({ ok: true });
}
