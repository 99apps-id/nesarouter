import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { readStore } from "@/lib/store";
import { usageChart } from "@/lib/usageAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? "14") || 14));
  const store = await readStore();
  return NextResponse.json({ days, points: usageChart(store.usage, days) });
}
