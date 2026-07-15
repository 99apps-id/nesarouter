import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { getTunnelStatus, restoreTunnelIfNeeded } from "@/lib/tunnel/manager";
import { getTailscaleStatus } from "@/lib/tunnel/tailscale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  await restoreTunnelIfNeeded();
  const [cloudflare, tailscale] = await Promise.all([getTunnelStatus(), getTailscaleStatus()]);
  return NextResponse.json({ cloudflare, tailscale });
}
