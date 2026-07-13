import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { McpServer } from "@/core/types";
import { deleteMcpServer, getMcpServer, readMcpServers, upsertMcpServer } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const servers = await readMcpServers();
  return NextResponse.json(
    servers.map((server) => ({
      ...server,
      env: Object.fromEntries(Object.keys(server.env ?? {}).map((key) => [key, "********"]))
    }))
  );
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
  // Drop keys removed from the incoming object when explicitly sent empty object? Keep merge-only on provided keys.
  const normalized: McpServer = {
    id: server.id,
    name: server.name,
    command: server.command,
    args: Array.isArray(server.args) ? server.args : [],
    env: Object.keys(incomingEnv).length ? mergedEnv : (existing?.env ?? {})
  };
  await upsertMcpServer(normalized);
  return NextResponse.json({
    ...normalized,
    env: Object.fromEntries(Object.keys(normalized.env ?? {}).map((key) => [key, "********"]))
  });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "MCP server id required." }, { status: 400 });
  await deleteMcpServer(body.id);
  return NextResponse.json({ ok: true });
}
