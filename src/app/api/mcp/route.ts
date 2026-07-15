import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { killBridge } from "@/core/mcpBridge";
import { McpServer } from "@/core/types";
import { deleteMcpServer, getMcpServer, readMcpServers, redactMcpServer, upsertMcpServer } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const servers = await readMcpServers();
  return NextResponse.json(servers.map(redactMcpServer));
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const server = (await request.json()) as McpServer;
  if (!server.id || !server.name || !server.command) {
    return NextResponse.json({ error: "MCP server id, name, and command are required." }, { status: 400 });
  }
  const existing = await getMcpServer(server.id);
  const incomingEnv = server.env && typeof server.env === "object" ? server.env : {};
  const mergedEnv: Record<string, string> = { ...(existing?.env ?? {}) };
  for (const [key, value] of Object.entries(incomingEnv)) {
    if (typeof value !== "string") continue;
    if (/^\*+$/.test(value)) continue; // keep existing secret
    mergedEnv[key] = value;
  }
  const normalized: McpServer = {
    id: server.id,
    name: server.name,
    command: server.command,
    args: Array.isArray(server.args) ? server.args : [],
    env: Object.keys(incomingEnv).length ? mergedEnv : (existing?.env ?? {})
  };
  // Restart child so command/env/args take effect on next session.
  killBridge(normalized.id);
  await upsertMcpServer(normalized);
  return NextResponse.json(redactMcpServer(normalized));
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "MCP server id required." }, { status: 400 });
  killBridge(body.id);
  await deleteMcpServer(body.id);
  return NextResponse.json({ ok: true });
}
