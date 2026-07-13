import { describe, expect, it } from "vitest";
import { usageStats } from "@/lib/usageAnalytics";
import type { UsageLog } from "@/core/types";

const sample: UsageLog[] = [
  {
    id: "a",
    createdAt: "2026-07-13T10:00:00.000Z",
    providerId: "p1",
    providerName: "Provider One",
    model: "gpt-test",
    tier: "cheap",
    taskType: "chat",
    inputTokens: 10,
    outputTokens: 5,
    totalCostUsd: 0.01,
    costSource: "estimated",
    cacheStatus: "miss",
    budgetStatus: "ok",
    routingReason: "test",
    status: "success"
  },
  {
    id: "b",
    createdAt: "2026-07-13T11:00:00.000Z",
    providerId: "p2",
    providerName: "Provider Two",
    model: "claude-test",
    tier: "premium",
    taskType: "chat",
    inputTokens: 20,
    outputTokens: 8,
    totalCostUsd: 0.02,
    costSource: "provider_usage",
    cacheStatus: "skipped",
    budgetStatus: "ok",
    routingReason: "test",
    status: "success"
  }
];

describe("usageAnalytics", () => {
  it("aggregates per provider and per model", () => {
    const stats = usageStats(sample);
    expect(stats.byProvider).toHaveLength(2);
    expect(stats.byModel).toHaveLength(2);
    expect(stats.byProvider[0]?.requests).toBeGreaterThan(0);
    expect(stats.byModel.some((row) => row.model === "gpt-test")).toBe(true);
  });
});
