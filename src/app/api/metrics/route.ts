import { NextResponse } from "next/server";
import { renderPrometheusText } from "@/core/runtimeMetrics";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeMetrics(request: Request): boolean {
  const required = process.env.NESA_METRICS_TOKEN?.trim();
  if (!required) return true;

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token")?.trim();
  if (queryToken && queryToken === required) return true;

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return Boolean(match && match[1]?.trim() === required);
}

export async function GET(request: Request) {
  if (!authorizeMetrics(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = await readStore();
    const body = renderPrometheusText(store);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "text/plain; version=0.0.4; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Failed to collect metrics." }, { status: 500 });
  }
}
