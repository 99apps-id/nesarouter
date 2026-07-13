import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { restartHeadroomProxy, startHeadroomProxy, stopHeadroomProxy } from "@/lib/headroom/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "start";
  const body = (await request.json().catch(() => ({}))) as { port?: number; codeAware?: boolean; kompress?: boolean };
  try {
    if (action === "stop") {
      return NextResponse.json(stopHeadroomProxy());
    }
    if (action === "restart") {
      return NextResponse.json(await restartHeadroomProxy(body));
    }
    return NextResponse.json(await startHeadroomProxy(body));
  } catch (error) {
    const code = (error as any)?.code;
    const status = code === "NOT_INSTALLED" || code === "NO_PYTHON" ? 400 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "headroom action failed", code }, { status });
  }
}
