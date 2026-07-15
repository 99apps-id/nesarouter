import { spawn, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { McpServer } from "@/core/types";

interface BridgeEntry {
  proc: ChildProcess;
  sessions: Map<string, (frame: string) => void>;
  /** Raw stdout bytes as string for Content-Length + NDJSON parsing. */
  buffer: string;
}

const BRIDGES_KEY = "__nesaMcpBridges";

function bridgesStore(): Map<string, BridgeEntry> {
  const g = globalThis as any;
  if (!g[BRIDGES_KEY]) g[BRIDGES_KEY] = new Map<string, BridgeEntry>();
  return g[BRIDGES_KEY];
}

const bridges = bridgesStore();

/** Encode a JSON-RPC message as MCP stdio Content-Length frame. */
export function encodeMcpFrame(message: unknown): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

/**
 * Extract complete MCP messages from a stdout buffer.
 * Prefers official Content-Length framing; falls back to NDJSON lines for
 * simple test servers.
 */
export function extractMcpMessages(buffer: string): { messages: string[]; rest: string } {
  const messages: string[] = [];
  let rest = buffer;

  for (;;) {
    const headerMatch = rest.match(/^Content-Length:\s*(\d+)\r?\n(?:[^\r\n]*\r?\n)*?\r?\n/i);
    if (headerMatch) {
      const length = Number(headerMatch[1]);
      const start = headerMatch[0].length;
      if (!Number.isFinite(length) || length < 0) {
        rest = rest.slice(headerMatch[0].length);
        continue;
      }
      if (rest.length < start + length) break;
      messages.push(rest.slice(start, start + length));
      rest = rest.slice(start + length);
      continue;
    }

    // NDJSON fallback (smoke / non-spec servers).
    if (rest.startsWith("{")) {
      const nl = rest.indexOf("\n");
      if (nl < 0) break;
      const line = rest.slice(0, nl).trim();
      rest = rest.slice(nl + 1);
      if (line) messages.push(line);
      continue;
    }

    // Drop leading junk until a frame or object starts.
    const next = rest.search(/Content-Length:|\{/i);
    if (next > 0) {
      rest = rest.slice(next);
      continue;
    }
    // Incomplete fragment (mid-header / mid-line) — keep buffered.
    break;
  }

  return { messages, rest };
}

function broadcast(entry: BridgeEntry, frame: string) {
  for (const send of entry.sessions.values()) {
    try {
      send(frame);
    } catch {
      /* session already closed */
    }
  }
}

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
    const extracted = extractMcpMessages(entry.buffer);
    entry.buffer = extracted.rest;
    for (const raw of extracted.messages) {
      broadcast(entry, `event: message\ndata: ${raw}\n\n`);
    }
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8").trim();
    if (!text) return;
    broadcast(entry, `event: stderr\ndata: ${JSON.stringify(text)}\n\n`);
  });

  proc.on("exit", (code) => {
    broadcast(entry, `event: exit\ndata: ${JSON.stringify({ code })}\n\n`);
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
    try {
      entry.proc.kill();
    } catch {
      /* ignore */
    }
    bridges.delete(serverId);
  }
}

/** Ensure the child is running, then write a Content-Length JSON-RPC frame. */
export function sendToChild(server: McpServer, jsonRpc: unknown) {
  const entry = getOrSpawn(server);
  if (!entry.proc.stdin?.writable) throw new Error(`MCP bridge stdin closed for ${server.id}`);
  entry.proc.stdin.write(encodeMcpFrame(jsonRpc));
}

export function isBridgeRunning(serverId: string): boolean {
  const entry = bridges.get(serverId);
  return !!(entry && entry.proc.exitCode === null && !entry.proc.killed);
}

export function killBridge(serverId: string) {
  const entry = bridges.get(serverId);
  if (!entry) return;
  try {
    entry.proc.kill();
  } catch {
    /* ignore */
  }
  bridges.delete(serverId);
}

export function killAllBridges() {
  for (const id of [...bridges.keys()]) killBridge(id);
}
