import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { getHeadroomLogTail, getInstallLogTail } from "@/lib/headroom/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const which = new URL(request.url).searchParams.get("which") ?? "proxy";
  const tail = which === "install" ? getInstallLogTail(50) : getHeadroomLogTail(200);
  return NextResponse.json({ tail });
}
