import { describe, expect, it } from "vitest";
import {
  encodeMcpFrame,
  extractMcpMessages,
  registerSession,
  sendToChild,
  unregisterSession
} from "@/core/mcpBridge";
import type { McpServer } from "@/core/types";

describe("mcpBridge framing", () => {
  it("encodes Content-Length frames", () => {
    const frame = encodeMcpFrame({ jsonrpc: "2.0", id: 1, method: "ping" });
    expect(frame).toMatch(/^Content-Length: \d+\r\n\r\n\{/);
    const body = frame.split("\r\n\r\n")[1];
    expect(JSON.parse(body).method).toBe("ping");
  });

  it("parses Content-Length stdout", () => {
    const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    const frame = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;
    const { messages, rest } = extractMcpMessages(frame + "partial");
    expect(messages).toEqual([payload]);
    expect(rest).toBe("partial");
  });

  it("parses byte-counted UTF-8 frames without corrupting the next frame", () => {
    const first = JSON.stringify({ jsonrpc: "2.0", id: 1, result: "Halo \u4f60\u597d" });
    const second = JSON.stringify({ jsonrpc: "2.0", id: 2, result: "selesai" });
    const framed =
      `Content-Length: ${Buffer.byteLength(first, "utf8")}\r\n\r\n${first}` +
      `Content-Length: ${Buffer.byteLength(second, "utf8")}\r\n\r\n${second}`;

    const { messages, rest } = extractMcpMessages(framed);
    expect(messages).toEqual([first, second]);
    expect(rest).toBe("");
  });

  it("routes child responses only to the owning SSE session", async () => {
    const server: McpServer = {
      id: `echo-${Date.now()}`,
      name: "Echo",
      command: process.execPath,
      args: ["-e", "process.stdin.on('data', chunk => process.stdout.write(chunk))"],
      env: {}
    };
    const firstFrames: string[] = [];
    const secondFrames: string[] = [];
    const firstId = registerSession(server, (frame) => firstFrames.push(frame));
    const secondId = registerSession(server, (frame) => secondFrames.push(frame));

    try {
      sendToChild(server, { jsonrpc: "2.0", id: 7, method: "ping" }, firstId);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(firstFrames.join("\n")).toContain('"id":7');
      expect(secondFrames).toEqual([]);
    } finally {
      unregisterSession(server.id, firstId);
      unregisterSession(server.id, secondId);
    }
  });

  it("falls back to NDJSON lines", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", id: 2, result: { echo: "hi" } });
    const { messages, rest } = extractMcpMessages(`${line}\n{`);
    expect(messages).toEqual([line]);
    expect(rest).toBe("{");
  });
});
