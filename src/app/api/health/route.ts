import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db: "ok" | "error" = "ok";
  let ready = true;
  try {
    await readStore();
  } catch {
    db = "error";
    ready = false;
  }

  return NextResponse.json({
    ok: true,
    ready,
    service: "nesa-router",
    version: process.env.NESA_APP_VERSION ?? "unknown",
    uptimeSec: Math.floor(process.uptime()),
    checks: { db }
  });
}
