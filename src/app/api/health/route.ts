import { NextResponse } from "next/server";
import { readAppVersion } from "@/lib/appVersion";
import { readStore } from "@/lib/store";
import { checkSaasAdmissionConfigHealth, checkSaasPostgresHealth } from "@/core/saas/saasHealth";
import { isSaasEnabled } from "@/core/saas/saasConfig";
import { ensureSaasBackgroundMaintenance } from "@/core/saas/saasMaintenance";

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

  const saasDb = await checkSaasPostgresHealth();
  if (saasDb === "error") ready = false;
  const saasLimits = checkSaasAdmissionConfigHealth();
  if (saasLimits.status === "error") {
    ready = false;
    if (saasLimits.errors.length) {
      console.error("[saas] admission misconfigured", saasLimits.errors);
    }
  }

  // Health probes also keep the settle-outbox / expire loop alive without a
  // separate worker process (pm2/Caddy hit this regularly).
  if (isSaasEnabled() && saasDb === "ok") ensureSaasBackgroundMaintenance();

  // ok = process responded (liveness). ready = DB usable (readiness).
  // Return 503 when not ready so orchestrators can use this as a readiness probe.
  return NextResponse.json(
    {
      ok: true,
      ready,
      service: "nesa-router",
      version: readAppVersion(),
      uptimeSec: Math.floor(process.uptime()),
      saas: isSaasEnabled(),
      checks: { db, saasDb, saasLimits: saasLimits.status }
    },
    { status: ready ? 200 : 503 }
  );
}
