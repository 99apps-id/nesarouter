import { NextResponse } from "next/server";
import { handleChat } from "@/core/chatHandler";
import { claudeStreamFromOpenAiSse, claudeToOpenAi, openAiToClaude } from "@/core/translator";
import { isRequestBodyTooLarge, readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SaaS overlay: auth is handled inside handleChat (SaaS client_keys), not OSS local keys. */
export async function POST(request: Request) {
  if (isRequestBodyTooLarge(request)) {
    return NextResponse.json(
      { type: "error", error: { type: "invalid_request_error", message: "Request body exceeds 16 MB." } },
      { status: 413 }
    );
  }
  let body: any;
  try {
    body = await readJsonBodyLimited(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ type: "error", error: { type: "invalid_request_error", message: error.message } }, { status: 413 });
    return NextResponse.json({ type: "error", error: { type: "invalid_request_error", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const openAiBody = claudeToOpenAi(body);
  const { response } = await handleChat(openAiBody, request);

  if (!response.ok) return response;

  const isStream = response.headers.get("content-type")?.includes("text/event-stream");
  if (isStream && response.body) {
    return new Response(claudeStreamFromOpenAiSse(response.body, body?.model ?? "claude"), {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-nesa-provider": response.headers.get("x-nesa-provider") ?? "",
        "x-nesa-budget-status": response.headers.get("x-nesa-budget-status") ?? "",
        "x-nesa-routing-reason": response.headers.get("x-nesa-routing-reason") ?? "",
        "x-nesa-latency-ms": response.headers.get("x-nesa-latency-ms") ?? ""
      }
    });
  }

  const payload = await response.json();
  return NextResponse.json(openAiToClaude(payload, body?.model ?? "claude"), {
    headers: {
      "x-nesa-provider": response.headers.get("x-nesa-provider") ?? "",
      "x-nesa-budget-status": response.headers.get("x-nesa-budget-status") ?? "",
      "x-nesa-cost-source": response.headers.get("x-nesa-cost-source") ?? "",
      "x-nesa-cache": response.headers.get("x-nesa-cache") ?? "",
      "x-nesa-routing-reason": response.headers.get("x-nesa-routing-reason") ?? "",
      "x-nesa-latency-ms": response.headers.get("x-nesa-latency-ms") ?? ""
    }
  });
}
