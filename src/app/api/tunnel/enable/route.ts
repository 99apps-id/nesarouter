import { NextResponse } from "next/server";
import { readAdminJson, requireAdmin } from "@/lib/adminApi";
import { enableTunnel, normalizeTunnelPort } from "@/lib/tunnel/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsedBody = await readAdminJson<{ port?: number }>(request, 16 * 1024);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.data;
  try {
    const port = body.port != null && String(body.port).trim() !== "" ? normalizeTunnelPort(body.port) : undefined;
    const result = await enableTunnel(port);
    return NextResponse.json({ ok: true, tunnelUrl: result.tunnelUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to enable tunnel." }, { status: 502 });
  }
}
