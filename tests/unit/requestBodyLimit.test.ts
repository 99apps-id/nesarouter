import { describe, expect, it } from "vitest";
import { readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

describe("bounded JSON request reader", () => {
  it("parses a valid chunked body without Content-Length", async () => {
    const request = new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"model":"auto"}'));
          controller.close();
        }
      }),
      duplex: "half"
    } as RequestInit & { duplex: "half" });
    await expect(readJsonBodyLimited(request, 100)).resolves.toEqual({ model: "auto" });
  });

  it("stops a chunked body when its actual bytes exceed the limit", async () => {
    const request = new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"value":"123456789"}'));
          controller.close();
        }
      }),
      duplex: "half"
    } as RequestInit & { duplex: "half" });
    await expect(readJsonBodyLimited(request, 8)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
