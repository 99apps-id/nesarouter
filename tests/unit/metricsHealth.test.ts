import { describe, expect, it } from "vitest";
import { authorizeMetrics, metricsWantsJson } from "@/core/metricsAuth";
import { readAppVersion } from "@/lib/appVersion";

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
