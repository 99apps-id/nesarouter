import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "nesa-router",
    version: process.env.NESA_APP_VERSION ?? "unknown",
    uptimeSec: Math.floor(process.uptime())
  });
}
