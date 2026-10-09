import { describe, expect, it } from "vitest";
import { readBodyBytesLimited, readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

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

describe("bounded binary reader (multipart uploads)", () => {
  function chunked(payload: Uint8Array, headers: Record<string, string> = {}) {
    return new Request("http://localhost/v1/audio/transcriptions", {
      method: "POST",
      headers,
      body: new ReadableStream({
        start(controller) {
          // Two chunks: the limit must be enforced across the whole stream, not per chunk.
          controller.enqueue(payload.slice(0, Math.ceil(payload.length / 2)));
          controller.enqueue(payload.slice(Math.ceil(payload.length / 2)));
          controller.close();
        }
      }),
      duplex: "half"
    } as RequestInit & { duplex: "half" });
  }

  it("enforces the cap on a chunked upload without Content-Length", async () => {
    const payload = new Uint8Array(4096).fill(0x41);
    await expect(readBodyBytesLimited(chunked(payload, { "content-type": "multipart/form-data; boundary=x" }), 1024))
      .rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("returns the exact bytes when the body fits", async () => {
    const payload = new Uint8Array(2048).fill(0x42);
    const bytes = await readBodyBytesLimited(chunked(payload), 4096);
    expect(bytes.byteLength).toBe(2048);
    expect(bytes[0]).toBe(0x42);
    expect(bytes[2047]).toBe(0x42);
  });

  it("rejects on Content-Length alone, before reading the body", async () => {
    const request = new Request("http://localhost/v1/audio/transcriptions", {
      method: "POST",
      headers: { "content-length": "999999" }
    });
    await expect(readBodyBytesLimited(request, 1024)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("parses back into a multipart FormData after the cap check", async () => {
    const boundary = "nesa-test-boundary";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="model"',
      "",
      "whisper-1",
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="a.webm"',
      "Content-Type: audio/webm",
      "",
      "AUDIOBYTES",
      `--${boundary}--`,
      ""
    ].join("\r\n");
    const request = new Request("http://localhost/v1/audio/transcriptions", {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body
    });

    const bytes = await readBodyBytesLimited(request, 64 * 1024);
    const form = await new Request("http://localhost/v1/audio/transcriptions", {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body: bytes
    }).formData();

    expect(form.get("model")).toBe("whisper-1");
    expect(await (form.get("file") as File).text()).toBe("AUDIOBYTES");
  });
});
