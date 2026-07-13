import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { checkForAppUpdate } from "@/lib/updateCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const force = new URL(request.url).searchParams.get("force") === "1";
  const result = await checkForAppUpdate({ force });
  return NextResponse.json(result);
}
