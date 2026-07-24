import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { killBridge } from "@/core/mcpBridge";
import { McpServer } from "@/core/types";
import { deleteMcpServer, getMcpServer, readMcpServers, redactMcpServer, upsertMcpServer } from "@/lib/store";
import { McpServerSchema } from "@/lib/validation";
import { logAdminAction } from "@/lib/adminAudit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const servers = await readMcpServers();
  return NextResponse.json(servers.map(redactMcpServer));
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = McpServerSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Validation failed." }, { status: 400 });
  }

  const existing = await getMcpServer(parsed.data.id);
  const incomingEnv = parsed.data.env && typeof parsed.data.env === "object" ? parsed.data.env : {};
  const mergedEnv: Record<string, string> = { ...(existing?.env ?? {}) };
  for (const [key, value] of Object.entries(incomingEnv)) {
    if (typeof value !== "string") continue;
    if (/^\*+$/.test(value)) continue; // keep existing secret
    mergedEnv[key] = value;
  }
  const normalized: McpServer = {
    id: parsed.data.id,
    name: parsed.data.name,
    command: parsed.data.command,
    args: Array.isArray(parsed.data.args) ? parsed.data.args : [],
    env: Object.keys(incomingEnv).length ? mergedEnv : (existing?.env ?? {})
  };
  // Restart child so command/env/args take effect on next session.
  killBridge(normalized.id);
  await upsertMcpServer(normalized);
  logAdminAction("settings.change", `MCP server "${normalized.name}" (${normalized.id}) saved.`, { mcpId: normalized.id });
  return NextResponse.json(redactMcpServer(normalized));
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const id = typeof body === "object" && body && "id" in body ? String((body as { id?: unknown }).id ?? "") : "";
  if (!id) return NextResponse.json({ error: "MCP server id required." }, { status: 400 });
  killBridge(id);
  await deleteMcpServer(id);
  logAdminAction("settings.change", `MCP server "${id}" deleted.`, { mcpId: id });
  return NextResponse.json({ ok: true });
}
