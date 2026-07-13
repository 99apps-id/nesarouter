import { describe, expect, it } from "vitest";
import { getProviderQuotaState, getProviderQuotaUsedToday } from "@/core/quota";
import { NesaStore, ProviderConfig, UsageLog } from "@/core/types";

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "p1",
    name: "P1",
    type: "openai_compatible",
    tier: "cheap",
    status: "active",
    baseUrl: "https://example.com/v1",
    apiKey: "k",
    model: "m",
    priority: 100,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    quotaLimitTokens: 10000,
    ...overrides
  };
}

function makeUsage(overrides: Partial<UsageLog> = {}): UsageLog {
  return {
    id: "u1",
    createdAt: new Date().toISOString(),
    providerId: "p1",
    providerName: "P1",
    model: "m",
    tier: "free",
    taskType: "chat",
    inputTokens: 100,
    outputTokens: 50,
    totalCostUsd: 0,
    costSource: "free",
    cacheStatus: "skipped",
    budgetStatus: "ok",
    routingReason: "auto",
    status: "success",
    ...overrides
  };
}

describe("quota", () => {
  it("returns null when no limit set", () => {
    const store = { usage: [] } as unknown as NesaStore;
    expect(getProviderQuotaState(makeProvider({ quotaLimitTokens: 0 }), store)).toBeNull();
    expect(getProviderQuotaState(makeProvider({ quotaLimitTokens: undefined }), store)).toBeNull();
  });

  it("sums today's successful usage for the provider", () => {
    const store = {
      usage: [
        makeUsage({ id: "a", providerId: "p1", inputTokens: 100, outputTokens: 50, status: "success" }),
        makeUsage({ id: "b", providerId: "p1", inputTokens: 200, outputTokens: 100, status: "success" }),
        makeUsage({ id: "c", providerId: "p1", inputTokens: 9999, outputTokens: 9999, status: "error" }),
        makeUsage({ id: "d", providerId: "other", inputTokens: 5000, outputTokens: 5000, status: "success" })
      ]
    } as unknown as NesaStore;
    expect(getProviderQuotaUsedToday(makeProvider(), store)).toBe(450);
  });

  it("marks exhausted when used >= limit", () => {
    const store = {
      usage: [makeUsage({ inputTokens: 9000, outputTokens: 1500 })]
    } as unknown as NesaStore;
    const state = getProviderQuotaState(makeProvider(), store)!;
    expect(state.exhausted).toBe(true);
    expect(state.remaining).toBe(0);
  });

  it("ignores usage from previous days", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const store = {
      usage: [makeUsage({ createdAt: yesterday, inputTokens: 99999, outputTokens: 99999 })]
    } as unknown as NesaStore;
    const state = getProviderQuotaState(makeProvider(), store)!;
    expect(state.exhausted).toBe(false);
    expect(state.remaining).toBe(10000);
  });
});
