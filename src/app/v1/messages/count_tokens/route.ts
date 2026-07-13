import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { estimateTokens } from "@/core/estimation";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /v1/messages/count_tokens — Anthropic-compatible token counting.
 * NesaRouter estimates locally (no upstream round-trip) so it works for any
 * provider/model combination.
 */
export async function POST(request: Request) {
  const store = await readStore();
  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const system = typeof body?.system === "string" ? body.system : "";
  const tools = Array.isArray(body?.tools) ? body.tools : [];

  let total = estimateTokens(system);
  for (const message of messages) {
    const text = typeof message?.content === "string"
      ? message.content
      : Array.isArray(message?.content)
        ? message.content.map((block: any) => block?.text ?? JSON.stringify(block?.input ?? "")).join("\n")
        : "";
    total += estimateTokens(text);
  }
  for (const tool of tools) {
    total += estimateTokens(JSON.stringify(tool?.input_schema ?? tool?.function ?? tool));
  }

  return NextResponse.json({ input_tokens: total });
}
