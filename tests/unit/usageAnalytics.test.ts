import { describe, expect, it } from "vitest";
import { usageChart, usageStats, usageSummary } from "@/lib/usageAnalytics";
import { calendarDayKey, usageDayKey } from "@/lib/store";
import type { UsageLog } from "@/core/types";

function log(partial: Partial<UsageLog>): UsageLog {
  return {
    id: partial.id ?? "a",
    createdAt: partial.createdAt ?? "2026-07-13T10:00:00.000Z",
    providerId: partial.providerId ?? "p1",
    providerName: partial.providerName ?? "Provider One",
    model: partial.model ?? "gpt-test",
    tier: partial.tier ?? "cheap",
    taskType: partial.taskType ?? "chat",
    inputTokens: partial.inputTokens ?? 10,
    outputTokens: partial.outputTokens ?? 5,
    totalCostUsd: partial.totalCostUsd ?? 0.01,
    costSource: partial.costSource ?? "estimated",
    cacheStatus: partial.cacheStatus ?? "miss",
    budgetStatus: partial.budgetStatus ?? "ok",
    routingReason: partial.routingReason ?? "test",
    status: partial.status ?? "success",
    ...partial
  };
}

const sample: UsageLog[] = [
  log({ id: "a", providerId: "p1", providerName: "Provider One", model: "gpt-test", status: "success" }),
  log({
    id: "b",
    createdAt: "2026-07-13T11:00:00.000Z",
    providerId: "p2",
    providerName: "Provider Two",
    model: "claude-test",
    inputTokens: 20,
    outputTokens: 8,
    totalCostUsd: 0.02,
    costSource: "provider_usage",
    cacheStatus: "skipped",
    status: "success"
  }),
  log({
    id: "c",
    createdAt: "2026-07-13T12:00:00.000Z",
    providerId: "p1",
    model: "gpt-test",
    status: "error",
    totalCostUsd: 0,
    inputTokens: 3,
    outputTokens: 0
  })
];

describe("usageAnalytics", () => {
  it("aggregates per provider and per model", () => {
    const stats = usageStats(sample);
    expect(stats.byProvider).toHaveLength(2);
    expect(stats.byModel).toHaveLength(2);
    expect(stats.byProvider[0]?.requests).toBeGreaterThan(0);
    expect(stats.byModel.some((row) => row.model === "gpt-test")).toBe(true);
  });

  it("counts successful and failed requests in summary", () => {
    const summary = usageSummary(sample);
    expect(summary.totalRequests).toBe(3);
    expect(summary.successCount).toBe(2);
    expect(summary.errorCount).toBe(1);
  });

  it("buckets chart points by local calendar day", () => {
    const localToday = calendarDayKey();
    const rows = [
      log({ id: "today", createdAt: new Date().toISOString(), status: "success" }),
      log({ id: "old", createdAt: "2020-01-01T12:00:00.000Z", status: "success" })
    ];
    const points = usageChart(rows, 3);
    expect(points).toHaveLength(3);
    expect(points.at(-1)?.date).toBe(localToday);
    expect(points.at(-1)?.requests).toBe(1);
    expect(usageDayKey(rows[0].createdAt)).toBe(localToday);
  });
});
