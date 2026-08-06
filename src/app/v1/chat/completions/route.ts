import { NextResponse } from "next/server";
import { handleChat } from "@/core/chatHandler";
import { isRequestBodyTooLarge, readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SaaS overlay: do NOT pre-auth with OSS authorizeClientRequest (local SQLite keys).
 * handleChat performs exclusive SaaS client_keys auth when NESA_SAAS_ENABLED=true.
 */
export async function POST(request: Request) {
  if (isRequestBodyTooLarge(request)) {
    return NextResponse.json({ error: { message: "Request body exceeds 16 MB." } }, { status: 413 });
  }
  let body: any;
  try {
    body = await readJsonBodyLimited(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: { message: error.message } }, { status: 413 });
    return NextResponse.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const { response } = await handleChat(body, request);
  return response;
}
