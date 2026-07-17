import { spawn, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { McpServer } from "@/core/types";

interface BridgeEntry {
  serverId: string;
  sid: string;
  proc: ChildProcess;
  send: (frame: string) => void;
  buffer: Buffer;
  close: () => void;
}

const BRIDGES_KEY = "__nesaMcpSessionBridgesV2";
const MAX_MCP_MESSAGE_BYTES = 8 * 1024 * 1024;
const MAX_MCP_BUFFER_BYTES = 16 * 1024 * 1024;
const MAX_MCP_SESSIONS = 8;
const MAX_MCP_SESSIONS_PER_SERVER = 2;

function bridgesStore(): Map<string, BridgeEntry> {
  const globalStore = globalThis as typeof globalThis & { [BRIDGES_KEY]?: Map<string, BridgeEntry> };
  if (!globalStore[BRIDGES_KEY]) globalStore[BRIDGES_KEY] = new Map<string, BridgeEntry>();
  return globalStore[BRIDGES_KEY];
}

const bridges = bridgesStore();

/** Encode a JSON-RPC message as an MCP stdio Content-Length frame. */
export function encodeMcpFrame(message: unknown): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function headerEnd(buffer: Buffer) {
  const crlf = buffer.indexOf("\r\n\r\n");
  if (crlf >= 0) return { index: crlf, size: 4 };
  const lf = buffer.indexOf("\n\n");
  return lf >= 0 ? { index: lf, size: 2 } : null;
}

function extractMcpBufferMessages(buffer: Buffer): { messages: string[]; rest: Buffer } {
  const messages: string[] = [];
  let rest = buffer;

  for (;;) {
    while (rest.length && /\s/.test(String.fromCharCode(rest[0]!))) rest = rest.subarray(1);
    if (!rest.length) break;

    const prefix = rest.subarray(0, Math.min(rest.length, 8192)).toString("ascii");
    if (/^content-length\s*:/i.test(prefix)) {
      const end = headerEnd(rest);
      if (!end) break;
      const header = rest.subarray(0, end.index).toString("ascii");
      const match = header.match(/(?:^|\r?\n)Content-Length:\s*(\d+)/i);
      const length = Number(match?.[1]);
      const bodyStart = end.index + end.size;
      if (!Number.isSafeInteger(length) || length < 0 || length > MAX_MCP_MESSAGE_BYTES) {
        rest = rest.subarray(bodyStart);
        continue;
      }
      if (rest.length < bodyStart + length) break;
      messages.push(rest.subarray(bodyStart, bodyStart + length).toString("utf8"));
      rest = rest.subarray(bodyStart + length);
      continue;
    }

    if (rest[0] === 0x7b) {
      const newline = rest.indexOf(0x0a);
      if (newline < 0) break;
      const line = rest.subarray(0, newline).toString("utf8").trim();
      rest = rest.subarray(newline + 1);
      if (line) messages.push(line);
      continue;
    }

    const lower = prefix.toLowerCase();
    const headerAt = lower.indexOf("content-length:");
    const objectAt = prefix.indexOf("{");
    const candidates = [headerAt, objectAt].filter((value) => value >= 0);
    if (candidates.length) {
      rest = rest.subarray(Math.min(...candidates));
      continue;
    }
    if (rest.length > 8192) rest = rest.subarray(rest.length - 128);
    break;
  }

  return { messages, rest };
}

/** String adapter kept for tests and callers that already have a complete buffer. */
export function extractMcpMessages(buffer: string): { messages: string[]; rest: string } {
  const extracted = extractMcpBufferMessages(Buffer.from(buffer, "utf8"));
  return { messages: extracted.messages, rest: extracted.rest.toString("utf8") };
}

function sendFrame(entry: BridgeEntry, frame: string) {
  try {
    entry.send(frame);
  } catch {
    // The SSE stream has already closed.
  }
}

function sseData(event: string, raw: string) {
  return `event: ${event}\n${raw.split(/\r?\n/).map((line) => `data: ${line}`).join("\n")}\n\n`;
}

function spawnForSession(server: McpServer, sid: string, send: (frame: string) => void, close: () => void): BridgeEntry {
  const env = { ...process.env, ...server.env };
  const proc = spawn(server.command, server.args ?? [], {
    stdio: ["pipe", "pipe", "pipe"],
    env,
    windowsHide: true
  });
  const entry: BridgeEntry = { serverId: server.id, sid, proc, send, buffer: Buffer.alloc(0), close };
  bridges.set(sid, entry);

  proc.stdout?.on("data", (chunk: Buffer) => {
    entry.buffer = Buffer.concat([entry.buffer, chunk]);
    if (entry.buffer.length > MAX_MCP_BUFFER_BYTES) {
      sendFrame(entry, `event: error\ndata: ${JSON.stringify("MCP stdout buffer exceeded 16 MB.")}\n\n`);
      entry.proc.kill();
      return;
    }
    const extracted = extractMcpBufferMessages(entry.buffer);
    entry.buffer = extracted.rest;
    for (const raw of extracted.messages) sendFrame(entry, sseData("message", raw));
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8").trim();
    if (text) sendFrame(entry, `event: stderr\ndata: ${JSON.stringify(text)}\n\n`);
  });

  proc.on("error", (error) => {
    sendFrame(entry, `event: error\ndata: ${JSON.stringify(error.message)}\n\n`);
    bridges.delete(sid);
    entry.close();
  });
  proc.on("exit", (code) => {
    sendFrame(entry, `event: exit\ndata: ${JSON.stringify({ code })}\n\n`);
    bridges.delete(sid);
    entry.close();
  });

  return entry;
}

export function registerSession(server: McpServer, send: (frame: string) => void, close: () => void = () => {}): string {
  const active = [...bridges.values()].filter((entry) => entry.proc.exitCode === null && !entry.proc.killed);
  if (active.length >= MAX_MCP_SESSIONS) throw new Error("MCP session limit reached.");
  if (active.filter((entry) => entry.serverId === server.id).length >= MAX_MCP_SESSIONS_PER_SERVER) {
    throw new Error(`MCP session limit reached for ${server.name}.`);
  }
  const sid = randomUUID();
  spawnForSession(server, sid, send, close);
  return sid;
}

export function unregisterSession(serverId: string, sid: string) {
  const entry = bridges.get(sid);
  if (!entry || entry.serverId !== serverId) return;
  try {
    entry.proc.kill();
  } catch {
    // Process already exited.
  }
  bridges.delete(sid);
}

function bridgeForRpc(serverId: string, sid?: string) {
  if (sid) {
    const entry = bridges.get(sid);
    return entry?.serverId === serverId ? entry : undefined;
  }
  const active = [...bridges.values()].filter(
    (entry) => entry.serverId === serverId && entry.proc.exitCode === null && !entry.proc.killed
  );
  if (active.length > 1) {
    throw new Error("Multiple MCP sessions are active. Send x-nesa-mcp-session or ?sessionId= from the SSE ready event.");
  }
  return active[0];
}

/** Write JSON-RPC only to the child process owned by the requesting SSE session. */
export function sendToChild(server: McpServer, jsonRpc: unknown, sid?: string) {
  const entry = bridgeForRpc(server.id, sid);
  if (!entry) throw new Error(`Open the MCP SSE endpoint for ${server.id} before sending RPC.`);
  if (!entry.proc.stdin?.writable) throw new Error(`MCP bridge stdin closed for ${server.id}`);
  const frame = encodeMcpFrame(jsonRpc);
  if (Buffer.byteLength(frame, "utf8") > MAX_MCP_MESSAGE_BYTES) throw new Error("MCP RPC message exceeds 8 MB.");
  entry.proc.stdin.write(frame);
}

export function isBridgeRunning(serverId: string): boolean {
  return [...bridges.values()].some(
    (entry) => entry.serverId === serverId && entry.proc.exitCode === null && !entry.proc.killed
  );
}

export function killBridge(serverId: string) {
  for (const entry of [...bridges.values()]) {
    if (entry.serverId !== serverId) continue;
    try {
      entry.proc.kill();
    } catch {
      // Process already exited.
    }
    bridges.delete(entry.sid);
  }
}

export function killAllBridges() {
  for (const serverId of new Set([...bridges.values()].map((entry) => entry.serverId))) killBridge(serverId);
}
