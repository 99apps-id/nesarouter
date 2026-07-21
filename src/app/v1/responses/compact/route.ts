import { NextResponse } from "next/server";
import { handleChat } from "@/core/chatHandler";
import { openAiToResponses, responsesStreamFromOpenAiSse, responsesToOpenAi } from "@/core/translator";
import { authorizeClientRequest, readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /v1/responses/compact — same pipeline as /v1/responses but signals a
 * compact context (Codex CLI uses this to trim conversation history). NesaRouter
 * honors the flag by forcing a non-streaming, trimmed response.
 */
export async function POST(request: Request) {
  if (!(await authorizeClientRequest(request))) return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  let body: any;
  try {
    body = await readJsonBodyLimited(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: { message: error.message } }, { status: 413 });
    return NextResponse.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const openAiBody = { ...responsesToOpenAi(body), stream: false };
  const { response } = await handleChat(openAiBody, request);
  if (!response.ok) return response;

  const payload = await response.json();
  return NextResponse.json(openAiToResponses(payload, body?.model ?? "responses"), {
    headers: {
      "x-nesa-provider": response.headers.get("x-nesa-provider") ?? "",
      "x-nesa-budget-status": response.headers.get("x-nesa-budget-status") ?? "",
      "x-nesa-cost-source": response.headers.get("x-nesa-cost-source") ?? "",
      "x-nesa-cache": response.headers.get("x-nesa-cache") ?? "",
      "x-nesa-compact": "1"
    }
  });
}
