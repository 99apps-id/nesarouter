import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const store = await readStore();
  return NextResponse.json(store.usage.slice(0, 100));
}
