import { NextResponse } from "next/server";
import { handleChat } from "@/core/chatHandler";
import { openAiToResponses, responsesStreamFromOpenAiSse, responsesToOpenAi } from "@/core/translator";
import { authorizeClientRequest, readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await authorizeClientRequest(request))) return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  let body: any;
  try {
    body = await readJsonBodyLimited(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: { message: error.message } }, { status: 413 });
    return NextResponse.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const openAiBody = responsesToOpenAi(body);
  const { response } = await handleChat(openAiBody, request);

  if (!response.ok) return response;

  const isStream = response.headers.get("content-type")?.includes("text/event-stream");
  if (isStream && response.body) {
    return new Response(responsesStreamFromOpenAiSse(response.body, body?.model ?? "responses"), {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-nesa-provider": response.headers.get("x-nesa-provider") ?? "",
        "x-nesa-budget-status": response.headers.get("x-nesa-budget-status") ?? ""
      }
    });
  }

  const payload = await response.json();
  return NextResponse.json(openAiToResponses(payload, body?.model ?? "responses"), {
    headers: {
      "x-nesa-provider": response.headers.get("x-nesa-provider") ?? "",
      "x-nesa-budget-status": response.headers.get("x-nesa-budget-status") ?? "",
      "x-nesa-cost-source": response.headers.get("x-nesa-cost-source") ?? "",
      "x-nesa-cache": response.headers.get("x-nesa-cache") ?? ""
    }
  });
}
