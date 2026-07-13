import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { TailscaleSetupError, disableTailscale, enableTailscale } from "@/lib/tunnel/tailscale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = (await request.json().catch(() => ({}))) as { port?: number; mode?: "serve" | "funnel" };
  const settings = await import("@/lib/store").then((m) => m.readTunnelSettings());
  const port = body.port ? Number(body.port) : settings.localPort;
  const mode = body.mode === "funnel" ? "funnel" : "serve";
  try {
    const result = await enableTailscale(port, mode);
    return NextResponse.json({ ok: true, url: result.url });
  } catch (error) {
    if (error instanceof TailscaleSetupError) {
      return NextResponse.json({
        error: error.message,
        kind: error.kind,
        enableUrl: error.enableUrl
      }, { status: 502 });
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
