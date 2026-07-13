import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { seedMissingProviders } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const added = seedMissingProviders();
  return NextResponse.json({ ok: true, added, count: added.length });
}
