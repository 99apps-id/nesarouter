import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const store = await readStore();
  const log = store.usage.find((item) => item.id === id);
  if (!log) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  return NextResponse.json(log);
}
