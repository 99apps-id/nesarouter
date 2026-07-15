import { describe, expect, it } from "vitest";
import {
  effectiveKeyQuotaLimit,
  getKeyQuotaState,
  getProviderQuotaState,
  getProviderQuotaUsedToday,
  isProviderRoutingQuotaExhausted
} from "@/core/quota";
import { pickActiveKeys } from "@/core/providerKeys";
import { NesaStore, ProviderConfig, UsageLog } from "@/core/types";

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "p1",
    name: "P1",
    type: "openai_compatible",
    tier: "cheap",
    status: "active",
    baseUrl: "https://example.com/v1",
    apiKey: "k1",
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

  it("prefers explicit per-key quota over provider quota", () => {
    const provider = makeProvider({
      apiKeys: ["k2"],
      keyQuotas: [{ quotaLimitTokens: 500 }, {}]
    });
    expect(effectiveKeyQuotaLimit(provider, 0)).toBe(500);
    expect(effectiveKeyQuotaLimit(provider, 1)).toBe(10000);
  });

  it("tracks per-key usage and keeps other keys available", () => {
    const provider = makeProvider({
      apiKey: "k1",
      apiKeys: ["k2"],
      quotaLimitTokens: 1000,
      keyQuotas: [{ quotaLimitTokens: 200 }, {}]
    });
    const store = {
      usage: [
        makeUsage({ id: "a", keyIndex: 0, inputTokens: 150, outputTokens: 50 }),
        makeUsage({ id: "b", keyIndex: 1, inputTokens: 100, outputTokens: 0 })
      ]
    } as unknown as NesaStore;

    expect(getKeyQuotaState(provider, store, 0)?.exhausted).toBe(true);
    expect(getKeyQuotaState(provider, store, 1)?.exhausted).toBe(false);
    expect(isProviderRoutingQuotaExhausted(provider, store)).toBe(false);

    const active = pickActiveKeys(provider, store);
    expect(active.map((item) => item.index)).toEqual([1]);
  });

  it("prefers explicit-quota keys first when both remain", () => {
    const provider = makeProvider({
      apiKey: "k1",
      apiKeys: ["k2"],
      quotaLimitTokens: 10000,
      keyQuotas: [{}, { quotaLimitTokens: 5000 }]
    });
    const store = { usage: [] } as unknown as NesaStore;
    const active = pickActiveKeys(provider, store);
    expect(active[0].index).toBe(1);
  });

  it("exhausts routing only when every limited key is exhausted", () => {
    const provider = makeProvider({
      apiKey: "k1",
      apiKeys: ["k2"],
      quotaLimitTokens: 100,
      keyQuotas: [{ quotaLimitTokens: 100 }, { quotaLimitTokens: 100 }]
    });
    const store = {
      usage: [
        makeUsage({ id: "a", keyIndex: 0, inputTokens: 100, outputTokens: 0 }),
        makeUsage({ id: "b", keyIndex: 1, inputTokens: 100, outputTokens: 0 })
      ]
    } as unknown as NesaStore;
    expect(isProviderRoutingQuotaExhausted(provider, store)).toBe(true);
  });
});
