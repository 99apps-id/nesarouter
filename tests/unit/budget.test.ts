import { describe, it, expect } from "vitest";
import { budgetMessage, getBudgetStatus } from "@/core/budget";
import { defaultStore } from "@/lib/defaults";
import { NesaStore, UsageLog } from "@/core/types";

function storeWithSpend(spendUsd: number): NesaStore {
  const log: UsageLog = {
    id: "t1",
    createdAt: new Date().toISOString(),
    providerId: "p",
    providerName: "P",
    model: "m",
    tier: "cheap",
    taskType: "chat",
    inputTokens: 0,
    outputTokens: 0,
    totalCostUsd: spendUsd,
    costSource: "estimated",
    cacheStatus: "miss",
    budgetStatus: "ok",
    routingReason: "test",
    status: "success"
  };
  return { ...defaultStore, providers: [], usage: [log] };
}

describe("budget", () => {
  it("reports ok under warning threshold", () => {
    const store = storeWithSpend(1);
    expect(getBudgetStatus(store)).toBe("ok");
  });

  it("reports warning at 80%", () => {
    const store = storeWithSpend(4);
    expect(getBudgetStatus(store)).toBe("warning");
  });

  it("reports critical at 95%", () => {
    const store = storeWithSpend(4.75);
    expect(getBudgetStatus(store)).toBe("critical");
  });

  it("reports exceeded at hard limit", () => {
    const store = storeWithSpend(5);
    expect(getBudgetStatus(store)).toBe("exceeded");
  });

  it("produces actionable messages", () => {
    expect(budgetMessage(defaultStore.budget, "exceeded")).toMatch(/blocked/i);
    expect(budgetMessage(defaultStore.budget, "critical")).toMatch(/free-tier/i);
    expect(budgetMessage(defaultStore.budget, "warning")).toMatch(/cheaper/i);
    expect(budgetMessage(defaultStore.budget, "ok")).toMatch(/within limit/i);
  });

  it("describes permissive hard-limit and notify-only policies accurately", () => {
    expect(budgetMessage({ ...defaultStore.budget, onExceeded: "allow_with_warning" }, "exceeded")).toMatch(/allowed/i);
    expect(budgetMessage({ ...defaultStore.budget, onWarning: "notify_only" }, "warning")).not.toMatch(/cheaper/i);
  });
});
