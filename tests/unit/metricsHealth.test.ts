import { describe, expect, it } from "vitest";
import { authorizeMetrics, metricsWantsJson } from "@/core/metricsAuth";
import { readAppVersion } from "@/lib/appVersion";
import { responsesErrorEnvelope } from "@/core/translator";
import { readStreamBounded, RequestBodyTooLargeError } from "@/core/auth";

describe("authorizeMetrics", () => {
  it("denies when NESA_METRICS_TOKEN is unset", async () => {
    const req = new Request("http://localhost/api/metrics");
    expect(await authorizeMetrics(req, "")).toBe(false);
    expect(await authorizeMetrics(req, undefined)).toBe(false);
  });

  it("accepts matching Bearer or query token", async () => {
    const token = "metrics-secret-token";
    expect(
      await authorizeMetrics(new Request("http://localhost/api/metrics", { headers: { authorization: `Bearer ${token}` } }), token)
    ).toBe(true);
    expect(await authorizeMetrics(new Request(`http://localhost/api/metrics?token=${token}`), token)).toBe(true);
  });

  it("rejects wrong token", async () => {
    expect(
      await authorizeMetrics(
        new Request("http://localhost/api/metrics", { headers: { authorization: "Bearer wrong" } }),
        "metrics-secret-token"
      )
    ).toBe(false);
  });
});

describe("readAppVersion for health", () => {
  it("returns a semver-like package version", () => {
    expect(readAppVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("responsesErrorEnvelope", () => {
  it("wraps a NesaRouter error body in the Responses envelope", () => {
    const envelope = responsesErrorEnvelope({ error: { message: "All fallback providers failed." } }, 502);
    expect(envelope.error.message).toBe("All fallback providers failed.");
    expect(envelope.error.type).toBe("server_error");
    expect(envelope.error.code).toBeNull();
  });

  it("keeps an upstream type/code when the provider supplied one", () => {
    const envelope = responsesErrorEnvelope(
      { error: { message: "rate limited", type: "rate_limit_exceeded", code: "rate_limit" } },
      429
    );
    expect(envelope.error.type).toBe("rate_limit_exceeded");
    expect(envelope.error.code).toBe("rate_limit");
  });

  it("never leaves the message empty, so Codex CLI has something to print", () => {
    expect(responsesErrorEnvelope(null, 503).error.message).toMatch(/503/);
    expect(responsesErrorEnvelope({ error: "plain string error" }, 400).error.message).toBe("plain string error");
    expect(responsesErrorEnvelope({}, 401).error.type).toBe("invalid_request_error");
  });
});

describe("bounded upstream reads", () => {
  function streamOf(size: number) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(size).fill(0x41));
        controller.close();
      }
    });
  }

  it("caps an upstream response so a broken peer cannot exhaust memory", async () => {
    await expect(readStreamBounded(streamOf(4096), 1024)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("reads a small upstream response", async () => {
    const bytes = await readStreamBounded(streamOf(64), 1024);
    expect(bytes.byteLength).toBe(64);
  });

  it("reports a sub-megabyte cap in KB, not as 0 MB", () => {
    expect(new RequestBodyTooLargeError(512 * 1024).message).toBe("Request body exceeds 512 KB.");
    expect(new RequestBodyTooLargeError(64 * 1024 * 1024).message).toBe("Request body exceeds 64 MB.");
  });
});

describe("metricsWantsJson", () => {
  it("accepts Prometheus-style scrapes", () => {
    expect(metricsWantsJson(null)).toBe(true);
    expect(metricsWantsJson("*/*")).toBe(true);
    expect(metricsWantsJson("text/plain")).toBe(true);
    expect(metricsWantsJson("application/json")).toBe(true);
  });

  it("rejects an SSE-only client so the route answers 406 instead of failing to serialise", () => {
    expect(metricsWantsJson("text/event-stream")).toBe(false);
    expect(metricsWantsJson("text/event-stream, */*;q=0.1")).toBe(false);
    // A browser that also accepts JSON keeps working.
    expect(metricsWantsJson("text/event-stream, application/json")).toBe(true);
  });
});
