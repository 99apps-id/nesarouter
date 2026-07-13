import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight web search passthrough.
 * Uses DuckDuckGo Instant Answer API (no key) as a free default so local installs work offline-of-paid-APIs.
 */
export async function POST(request: Request) {
  const store = await readStore();
  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const query = typeof body?.query === "string" ? body.query.trim() : typeof body?.q === "string" ? body.q.trim() : "";
  if (!query) return NextResponse.json({ error: { message: "query is required." } }, { status: 400 });

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    return NextResponse.json({
      object: "search.results",
      query,
      abstract: data.AbstractText || "",
      abstractUrl: data.AbstractURL || "",
      heading: data.Heading || "",
      related: Array.isArray(data.RelatedTopics)
        ? data.RelatedTopics.slice(0, 8).map((item: any) => ({
            text: item.Text || item.Name || "",
            url: item.FirstURL || ""
          })).filter((item: any) => item.text)
        : []
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Search failed." } },
      { status: 502 }
    );
  }
}
