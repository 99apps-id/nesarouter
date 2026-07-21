import { NextResponse } from "next/server";
import { authorizeRequest, readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";
import { ExternalUrlValidationError, fetchExternalText } from "@/core/safeWebFetch";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const store = await readStore();
  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  }

  let body: any;
  try {
    body = await readJsonBodyLimited(request, 1024 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: { message: error.message } }, { status: 413 });
    return NextResponse.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  if (!rawUrl) return NextResponse.json({ error: { message: "url is required." } }, { status: 400 });

  try {
    const result = await fetchExternalText(rawUrl);
    return NextResponse.json({
      object: "web.fetch",
      ...result
    });
  } catch (error) {
    if (error instanceof ExternalUrlValidationError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Fetch failed." } },
      { status: 502 }
    );
  }
}
