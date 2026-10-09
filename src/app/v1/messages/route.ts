import { NextResponse } from "next/server";
import { handleChat } from "@/core/chatHandler";
import { claudeStreamFromOpenAiSse, claudeToOpenAi, openAiToClaude } from "@/core/translator";
import { authorizeClientRequest, readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await authorizeClientRequest(request))) return NextResponse.json({ type: "error", error: { type: "authentication_error", message: "Invalid NesaRouter API key." } }, { status: 401 });
  let body: any;
  try {
    body = await readJsonBodyLimited(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ type: "error", error: { type: "invalid_request_error", message: error.message } }, { status: 413 });
    return NextResponse.json({ type: "error", error: { type: "invalid_request_error", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const openAiBody = claudeToOpenAi(body);
  const { response } = await handleChat(openAiBody, request);

  // Claude clients parse `{type:"error",error:{type,message}}`; a raw OpenAI
  // error body surfaces only as an opaque "unknown error" in the Anthropic SDK.
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      (typeof payload?.error?.message === "string" && payload.error.message) ||
      (typeof payload?.error === "string" && payload.error) ||
      `NesaRouter upstream error (${response.status}).`;
    const errorType =
      response.status === 401 || response.status === 403
        ? "authentication_error"
        : response.status === 429
          ? "rate_limit_error"
          : response.status >= 500
            ? "api_error"
            : "invalid_request_error";
    return NextResponse.json(
      { type: "error", error: { type: errorType, message } },
      { status: response.status }
    );
  }

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
