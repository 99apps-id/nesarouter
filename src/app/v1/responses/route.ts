import { NextResponse } from "next/server";
import { handleChat } from "@/core/chatHandler";
import { openAiToResponses, responsesStreamFromOpenAiSse, responsesToOpenAi } from "@/core/translator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
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
