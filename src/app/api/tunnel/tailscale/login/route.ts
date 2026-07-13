import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { startLogin } from "@/lib/tunnel/tailscale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { loginUrl } = await startLogin();
    return NextResponse.json({ ok: true, loginUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tailscale login failed." }, { status: 502 });
  }
}
