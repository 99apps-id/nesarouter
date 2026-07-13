import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { sendToChild } from "@/core/mcpBridge";
import { getMcpServer, readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const store = await readStore();
  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  }
  const server = await getMcpServer(id);
  if (!server) return NextResponse.json({ error: { message: "MCP server not found." } }, { status: 404 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Request body must be valid JSON-RPC." } }, { status: 400 });
  }

  try {
    sendToChild(server.id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "MCP bridge unavailable." } },
      { status: 502 }
    );
  }
}
