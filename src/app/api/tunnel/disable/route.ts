import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { disableTunnel } from "@/lib/tunnel/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    await disableTunnel();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to disable tunnel." }, { status: 502 });
  }
}
