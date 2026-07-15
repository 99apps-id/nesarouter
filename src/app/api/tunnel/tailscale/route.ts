import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { TailscaleSetupError, disableTailscale, enableTailscale } from "@/lib/tunnel/tailscale";
import { normalizeTunnelPort } from "@/lib/tunnel/port";
import { readTunnelSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = (await request.json().catch(() => ({}))) as { port?: number; mode?: "serve" | "funnel" };
  const settings = await readTunnelSettings();
  try {
    const port = normalizeTunnelPort(
      body.port != null && String(body.port).trim() !== "" ? body.port : settings.localPort,
      Number(process.env.PORT) || 20129
    );
    const mode = body.mode === "funnel" ? "funnel" : settings.tailscaleMode === "funnel" ? "funnel" : "serve";
    const resolvedMode = body.mode === "funnel" || body.mode === "serve" ? body.mode : mode;
    const result = await enableTailscale(port, resolvedMode);
    return NextResponse.json({ ok: true, url: result.url, mode: resolvedMode, port });
  } catch (error) {
    if (error instanceof TailscaleSetupError) {
      return NextResponse.json(
        {
          error: error.message,
          kind: error.kind,
          enableUrl: error.enableUrl
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to enable Tailscale." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  await disableTailscale();
  return NextResponse.json({ ok: true });
}
