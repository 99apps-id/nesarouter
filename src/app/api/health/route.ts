import { NextResponse } from "next/server";
import { readAppVersion } from "@/lib/appVersion";
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

  // ok = process responded (liveness). ready = DB usable (readiness).
  // Return 503 when not ready so orchestrators can use this as a readiness probe.
  return NextResponse.json(
    {
      ok: true,
      ready,
      service: "nesa-router",
      version: readAppVersion(),
      uptimeSec: Math.floor(process.uptime()),
      checks: { db }
    },
    { status: ready ? 200 : 503 }
  );
}
