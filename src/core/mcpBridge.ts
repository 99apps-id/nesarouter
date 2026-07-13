import { spawn, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { McpServer } from "@/core/types";

interface BridgeEntry {
  proc: ChildProcess;
  sessions: Map<string, (frame: string) => void>;
  buffer: string;
}

const BRIDGES_KEY = "__nesaMcpBridges";

function bridgesStore(): Map<string, BridgeEntry> {
  const g = globalThis as any;
  if (!g[BRIDGES_KEY]) g[BRIDGES_KEY] = new Map<string, BridgeEntry>();
  return g[BRIDGES_KEY];
}

const bridges = bridgesStore();

function getOrSpawn(server: McpServer): BridgeEntry {
  const existing = bridges.get(server.id);
  if (existing && existing.proc.exitCode === null && !existing.proc.killed) return existing;

  const env = { ...process.env, ...server.env };
  const proc = spawn(server.command, server.args ?? [], {
    stdio: ["pipe", "pipe", "pipe"],
    env,
    windowsHide: true
  });
  const entry: BridgeEntry = { proc, sessions: new Map(), buffer: "" };
  bridges.set(server.id, entry);

  proc.stdout?.on("data", (chunk: Buffer) => {
    entry.buffer += chunk.toString("utf8");
    let idx = entry.buffer.indexOf("\n");
    while (idx >= 0) {
      const raw = entry.buffer.slice(0, idx).trim();
      entry.buffer = entry.buffer.slice(idx + 1);
      idx = entry.buffer.indexOf("\n");
      if (!raw) continue;
      const frame = `event: message\ndata: ${raw}\n\n`;
      for (const send of entry.sessions.values()) {
        try { send(frame); } catch {}
      }
    }
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    const frame = `event: stderr\ndata: ${JSON.stringify(chunk.toString("utf8").trim())}\n\n`;
    for (const send of entry.sessions.values()) {
      try { send(frame); } catch {}
    }
  });

  proc.on("exit", (code) => {
    const frame = `event: exit\ndata: ${JSON.stringify({ code })}\n\n`;
    for (const send of entry.sessions.values()) {
      try { send(frame); } catch {}
    }
    bridges.delete(server.id);
  });

  return entry;
}

export function registerSession(server: McpServer, send: (frame: string) => void): string {
  const entry = getOrSpawn(server);
  const sid = randomUUID();
  entry.sessions.set(sid, send);
  return sid;
}

export function unregisterSession(serverId: string, sid: string) {
  const entry = bridges.get(serverId);
  if (!entry) return;
  entry.sessions.delete(sid);
  if (entry.sessions.size === 0) {
    try { entry.proc.kill(); } catch {}
    bridges.delete(serverId);
  }
}

export function sendToChild(serverId: string, jsonRpc: unknown) {
  const entry = bridges.get(serverId);
  if (!entry?.proc?.stdin?.writable) throw new Error(`MCP bridge not running for ${serverId}`);
  entry.proc.stdin.write(`${JSON.stringify(jsonRpc)}\n`);
}

export function isBridgeRunning(serverId: string): boolean {
  const entry = bridges.get(serverId);
  return !!(entry && entry.proc.exitCode === null && !entry.proc.killed);
}

export function killAllBridges() {
  for (const [, entry] of bridges) {
    try { entry.proc.kill(); } catch {}
  }
  bridges.clear();
}
