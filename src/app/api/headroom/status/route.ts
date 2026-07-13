import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { DEFAULT_HEADROOM_URL, getHeadroomStatus } from "@/lib/headroom/detect";
import { getManagedPid } from "@/lib/headroom/process";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const store = await readStore();
  const url = new URL(request.url).searchParams.get("url") || store.router.headroomUrl || DEFAULT_HEADROOM_URL;
  const status = await getHeadroomStatus(url);
  return NextResponse.json({
    ...status,
    pid: getManagedPid(),
    url,
    pipelineEnabled: Boolean(store.router.headroomEnabled),
    compressUserMessages: Boolean(store.router.headroomCompressUserMessages)
  });
}
