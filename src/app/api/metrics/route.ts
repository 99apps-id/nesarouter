import { NextResponse } from "next/server";
import { authorizeMetrics, metricsWantsJson } from "@/core/metricsAuth";
import { renderPrometheusText } from "@/core/runtimeMetrics";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // SSE clients (Accept: text/event-stream) make Next's response streams non-JSON,
  // which used to surface as an unhelpful 500 from this JSON-only endpoint.
  if (!metricsWantsJson(request.headers.get("accept"))) {
    return NextResponse.json(
      { error: "GET /api/metrics only returns Prometheus text or JSON. Send Accept: application/json or */*." },
      { status: 406 }
    );
  }

  if (!(await authorizeMetrics(request))) {
    const configured = Boolean(process.env.NESA_METRICS_TOKEN?.trim());
    return NextResponse.json(
      {
        error: configured
          ? "Unauthorized"
          : "Metrics disabled. Set NESA_METRICS_TOKEN to enable Prometheus scrape."
      },
      { status: 401 }
    );
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
