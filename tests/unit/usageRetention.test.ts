import { describe, expect, it } from "vitest";
import { USAGE_RETENTION_ROWS, appendUsage, readStore, startOfTodayIso } from "@/lib/store";
import { UsageLog } from "@/core/types";

function usageLog(index: number, createdAt = new Date().toISOString()): UsageLog {
  return {
    id: `retention-probe-${index}`,
    createdAt,
    providerId: "retention-probe",
    providerName: "Retention probe",
    model: "probe",
    tier: "cheap",
    taskType: "chat",
    inputTokens: 1,
    outputTokens: 1,
    totalCostUsd: 1,
    costSource: "estimated",
    cacheStatus: "miss",
    budgetStatus: "ok",
    routingReason: "retention regression",
    status: "success"
  };
}

describe("usage retention", () => {
  it("keeps every row created today even beyond the history cap", async () => {
    const total = USAGE_RETENTION_ROWS + 20;
    for (let index = 0; index < total; index += 1) {
      await appendUsage(usageLog(index));
    }

    const store = await readStore();
    const todayRows = store.usage.filter((item) => item.providerId === "retention-probe");
    // Daily spend and daily per-key/per-provider quotas are summed from this list:
    // trimming today's rows would silently disable budget and quota enforcement.
    expect(todayRows.length).toBe(total);
  });

  it("still prunes rows from previous days outside the history window", async () => {
    const oldDay = new Date(startOfTodayIso());
    oldDay.setDate(oldDay.getDate() - 3);
    const total = USAGE_RETENTION_ROWS + 20;
    for (let index = 0; index < total; index += 1) {
      await appendUsage(usageLog(1000 + index, oldDay.toISOString()));
    }

    const store = await readStore();
    const oldRows = store.usage.filter(
      (item) => item.providerId === "retention-probe" && item.createdAt < startOfTodayIso()
    );
    expect(oldRows.length).toBeLessThan(total);
  });
});
