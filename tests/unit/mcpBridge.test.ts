import { describe, expect, it } from "vitest";
import { encodeMcpFrame, extractMcpMessages } from "@/core/mcpBridge";

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

  it("falls back to NDJSON lines", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", id: 2, result: { echo: "hi" } });
    const { messages, rest } = extractMcpMessages(`${line}\n{`);
    expect(messages).toEqual([line]);
    expect(rest).toBe("{");
  });
});
