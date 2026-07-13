import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { disableTunnel } from "@/lib/tunnel/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  await disableTunnel();
  return NextResponse.json({ ok: true });
}
