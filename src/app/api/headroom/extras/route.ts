import { NextResponse } from "next/server";
import { readAdminJson, requireAdmin } from "@/lib/adminApi";
import { HeadroomExtra } from "@/lib/headroom/detect";
import { installHeadroomExtras, uninstallHeadroomExtras } from "@/lib/headroom/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsedBody = await readAdminJson<{ extras?: HeadroomExtra[]; action?: "install" | "uninstall" }>(request, 16 * 1024);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.data;
  const extras = Array.isArray(body.extras) ? body.extras : [];
  try {
    const result = body.action === "uninstall"
      ? await uninstallHeadroomExtras(extras)
      : await installHeadroomExtras(extras);
    return NextResponse.json(result);
  } catch (error) {
    const code = (error as any)?.code;
    const status = code === "NO_PYTHON" || code === "NOT_INSTALLED" ? 400 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "extras action failed", code }, { status });
  }
}
