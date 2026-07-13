import { describe, expect, it } from "vitest";
import { usageChart, usageStats } from "@/lib/usageAnalytics";
import { UsageLog } from "@/core/types";

function makeUsage(overrides: Partial<UsageLog>): UsageLog {
  return {
    id: "u",
    createdAt: new Date().toISOString(),
    providerId: "p1",
    providerName: "P1",
    model: "m",
    tier: "free",
    taskType: "chat",
    inputTokens: 10,
    outputTokens: 5,
    totalCostUsd: 0.001,
    costSource: "estimated",
    cacheStatus: "skipped",
    budgetStatus: "ok",
    routingReason: "auto",
    status: "success",
    ...overrides
  };
}

describe("usageStats", () => {
  it("aggregates totals, providers, and cache rate", () => {
    const stats = usageStats([
      makeUsage({ id: "a", status: "success", cacheStatus: "hit", totalCostUsd: 0.1 }),
      makeUsage({ id: "b", status: "error", cacheStatus: "skipped", totalCostUsd: 0, providerId: "p2", providerName: "P2" }),
      makeUsage({ id: "c", status: "success", cacheStatus: "hit", totalCostUsd: 0.2 })
    ]);
    expect(stats.totalRequests).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.errorCount).toBe(1);
    expect(stats.cacheHits).toBe(2);
    expect(stats.cacheHitRate).toBeCloseTo(2 / 3);
    expect(stats.byProvider).toHaveLength(2);
    expect(stats.byProvider[0].requests).toBe(2);
  });
});

describe("usageChart", () => {
  it("emits one point per day for the requested window", () => {
    const points = usageChart([makeUsage({ id: "a" }), makeUsage({ id: "b" })], 7);
    expect(points).toHaveLength(7);
    const today = points[points.length - 1];
    expect(today.requests).toBe(2);
    expect(today.success).toBe(2);
  });

  it("ignores usage outside the window", () => {
    const old = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const points = usageChart([makeUsage({ id: "old", createdAt: old })], 14);
    expect(points.reduce((s, p) => s + p.requests, 0)).toBe(0);
  });
});
