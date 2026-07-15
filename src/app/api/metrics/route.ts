import { NextResponse } from "next/server";
import { timingSafeEqualString } from "@/core/adminSessionCookie";
import { renderPrometheusText } from "@/core/runtimeMetrics";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Metrics are deny-by-default. Set NESA_METRICS_TOKEN and pass it via
 * `Authorization: Bearer …` or `?token=`.
 */
export async function authorizeMetrics(
  request: Request,
  tokenEnv = process.env.NESA_METRICS_TOKEN
): Promise<boolean> {
  const required = tokenEnv?.trim();
  if (!required) return false;

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token")?.trim() ?? "";
  if (queryToken && (await timingSafeEqualString(queryToken, required))) return true;

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const bearer = match?.[1]?.trim() ?? "";
  return Boolean(bearer && (await timingSafeEqualString(bearer, required)));
}

export async function GET(request: Request) {
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
