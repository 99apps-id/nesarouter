import { describe, expect, it } from "vitest";
import { authorizeMetrics } from "@/core/metricsAuth";
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
