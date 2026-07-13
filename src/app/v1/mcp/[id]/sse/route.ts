import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { registerSession, unregisterSession } from "@/core/mcpBridge";
import { getMcpServer, readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const store = await readStore();
  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  }
  const server = await getMcpServer(id);
  if (!server) return NextResponse.json({ error: { message: "MCP server not found." } }, { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (frame: string) => {
        try { controller.enqueue(encoder.encode(frame)); } catch {}
      };
      const sid = registerSession(server, send);
      send(`event: ready\ndata: ${JSON.stringify({ server: server.name, sessionId: sid })}\n\n`);

      const close = () => {
        unregisterSession(server.id, sid);
        try { controller.close(); } catch {}
      };
      request.signal.addEventListener("abort", close);
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive"
    }
  });
}
