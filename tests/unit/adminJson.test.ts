import { describe, expect, it } from "vitest";
import { readAdminJson } from "@/lib/adminApi";

describe("readAdminJson", () => {
  it("parses a JSON body below the configured limit", async () => {
    const result = await readAdminJson<{ name: string }>(
      new Request("http://localhost/api/example", {
        method: "POST",
        body: JSON.stringify({ name: "NesaRouter" })
      }),
      1024
    );

    expect(result.response).toBeUndefined();
    expect(result.data).toEqual({ name: "NesaRouter" });
  });

  it("returns 400 for malformed JSON", async () => {
    const result = await readAdminJson(
      new Request("http://localhost/api/example", { method: "POST", body: "{" }),
      1024
    );

    expect(result.response?.status).toBe(400);
    await expect(result.response?.json()).resolves.toEqual({ error: "Invalid JSON body." });
  });

  it("returns 413 for an oversized body even without Content-Length", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"value":"'));
        controller.enqueue(encoder.encode("x".repeat(64)));
        controller.enqueue(encoder.encode('"}'));
        controller.close();
      }
    });
    const result = await readAdminJson(
      new Request("http://localhost/api/example", {
        method: "POST",
        body: stream,
        duplex: "half"
      } as RequestInit & { duplex: "half" }),
      32
    );

    expect(result.response?.status).toBe(413);
    await expect(result.response?.json()).resolves.toEqual({ error: "Request body exceeds 1 KB." });
  });
});
