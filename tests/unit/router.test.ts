import { describe, it, expect } from "vitest";
import { chooseProvider, findCombo } from "@/core/router";
import { defaultStore } from "@/lib/defaults";
import { NesaStore, ProviderConfig, Combo, UsageLog } from "@/core/types";

function provider(partial: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: partial.id ?? "p",
    name: partial.name ?? "P",
    type: "openai_compatible",
    tier: partial.tier ?? "free",
    status: "active",
    baseUrl: "http://example/v1",
    apiKey: "key",
    model: partial.model ?? "m",
    priority: partial.priority ?? 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    ...partial
  };
}

function storeWith(providers: ProviderConfig[], combos: Combo[] = []): NesaStore {
  return { ...defaultStore, providers, combos, usage: [] };
}

describe("router", () => {
  it("prefers free tier in auto mode when preferFreeTier is on", () => {
    const store = storeWith([
      provider({ id: "paid", name: "Paid", tier: "premium", model: "gpt", priority: 1 }),
      provider({ id: "free", name: "Free", tier: "free", model: "free-model", priority: 5 })
    ]);
    const decision = chooseProvider(store, { model: "auto", messages: [{ role: "user", content: "hi" }] });
    expect(decision.provider.id).toBe("free");
  });

  it("matches an explicit model to its provider", () => {
    const store = storeWith([
      provider({ id: "paid", name: "Paid", tier: "premium", model: "gpt-4", priority: 1 }),
      provider({ id: "free", name: "Free", tier: "free", model: "free-model", priority: 5 })
    ]);
    const decision = chooseProvider(store, { model: "gpt-4", messages: [{ role: "user", content: "hi" }] });
    expect(decision.provider.id).toBe("paid");
  });

  it("throws when an unknown model is requested", () => {
    const store = storeWith([provider({ id: "free", model: "free-model" })]);
    expect(() => chooseProvider(store, { model: "nope", messages: [] })).toThrow(/not configured/);
  });

  it("routes through a combo in the declared provider order", () => {
    const combo: Combo = { id: "c1", name: "my-combo", providerIds: ["paid", "free"], strategy: "fallback" };
    const store = storeWith(
      [
        provider({ id: "paid", name: "Paid", tier: "premium", model: "gpt-4", priority: 1 }),
        provider({ id: "free", name: "Free", tier: "free", model: "free-model", priority: 5 })
      ],
      [combo]
    );
    const decision = chooseProvider(store, { model: "my-combo", messages: [{ role: "user", content: "hi" }] }, [], combo);
    expect(decision.provider.id).toBe("paid");
    expect(decision.routingReason).toMatch(/Combo my-combo/);
  });

  it("skips combo providers marked failed and uses the next", () => {
    const combo: Combo = { id: "c1", name: "my-combo", providerIds: ["paid", "free"], strategy: "fallback" };
    const store = storeWith(
      [
        provider({ id: "paid", name: "Paid", tier: "premium", model: "gpt-4", priority: 1 }),
        provider({ id: "free", name: "Free", tier: "free", model: "free-model", priority: 5 })
      ],
      [combo]
    );
    const decision = chooseProvider(store, { model: "my-combo", messages: [{ role: "user", content: "hi" }] }, ["paid"], combo);
    expect(decision.provider.id).toBe("free");
    expect(decision.skippedProviders.some((s) => s.providerId === "paid")).toBe(true);
  });

  it("findCombo matches by name or id and ignores auto", () => {
    const combo: Combo = { id: "c1", name: "my-combo", providerIds: ["p"], strategy: "fallback" };
    const store = storeWith([provider({ id: "p" })], [combo]);
    expect(findCombo(store, "my-combo")?.id).toBe("c1");
    expect(findCombo(store, "c1")?.id).toBe("c1");
    expect(findCombo(store, "auto")).toBeUndefined();
  });

  it("skips a provider whose daily token quota is exhausted and reports the reason", () => {
    const usage: UsageLog = {
      id: "u1",
      createdAt: new Date().toISOString(),
      providerId: "paid",
      providerName: "Paid",
      model: "gpt-4",
      tier: "premium",
      taskType: "chat",
      inputTokens: 50,
      outputTokens: 50,
      totalCostUsd: 0,
      costSource: "estimated",
      cacheStatus: "skipped",
      budgetStatus: "ok",
      routingReason: "auto",
      status: "success"
    };
    const store: NesaStore = {
      ...defaultStore,
      providers: [provider({ id: "paid", model: "gpt-4", quotaLimitTokens: 10 })],
      combos: [],
      usage: [usage]
    };
    expect(() => chooseProvider(store, { model: "gpt-4", messages: [{ role: "user", content: "hi" }] })).toThrow(/quota/i);
  });

  it("keeps a free-tier provider available at the critical budget guard", () => {
    const store = storeWith([
      provider({ id: "paid", name: "Paid", tier: "premium", model: "gpt-4", priority: 1 }),
      provider({ id: "groq", name: "Groq", tier: "cheap", model: "llama", priority: 5 })
    ]);
    store.budget = { ...store.budget, dailyBudgetUsd: 1, onCritical: "free_tier_only" };
    store.usage = [{
      id: "critical-spend",
      createdAt: new Date().toISOString(),
      providerId: "old",
      providerName: "Old",
      model: "old",
      tier: "cheap",
      taskType: "chat",
      inputTokens: 0,
      outputTokens: 0,
      totalCostUsd: 0.96,
      costSource: "estimated",
      cacheStatus: "miss",
      budgetStatus: "critical",
      routingReason: "test",
      status: "success"
    }];

    const decision = chooseProvider(store, { model: "auto", messages: [{ role: "user", content: "hi" }] });
    expect(decision.provider.id).toBe("groq");
  });

  it("blocks a paid route at the hard limit and continues with a free provider", () => {
    const store = storeWith([
      provider({ id: "paid", name: "Paid", tier: "premium", model: "gpt-4", priority: 1 }),
      provider({ id: "free", name: "Free", tier: "free", model: "local", priority: 2 })
    ]);
    store.router = { ...store.router, routingMode: "best", preferFreeTier: false };
    store.budget = { ...store.budget, dailyBudgetUsd: 1, onExceeded: "block_paid" };
    store.usage = [{
      id: "hard-limit-spend",
      createdAt: new Date().toISOString(),
      providerId: "old",
      providerName: "Old",
      model: "old",
      tier: "premium",
      taskType: "chat",
      inputTokens: 0,
      outputTokens: 0,
      totalCostUsd: 1,
      costSource: "estimated",
      cacheStatus: "miss",
      budgetStatus: "exceeded",
      routingReason: "test",
      status: "success"
    }];

    const decision = chooseProvider(store, { model: "auto", messages: [{ role: "user", content: "hi" }] });
    expect(decision.provider.id).toBe("free");
    expect(decision.skippedProviders).toContainEqual({ providerId: "paid", reason: "Skipped by budget guard." });
  });

  it("applies combo round_robin even when global providerStrategy is priority", () => {
    const combo: Combo = { id: "c1", name: "rr-combo", providerIds: ["a", "b"], strategy: "round_robin" };
    const usage: UsageLog = {
      id: "u1",
      createdAt: new Date().toISOString(),
      providerId: "a",
      providerName: "A",
      model: "m",
      tier: "free",
      taskType: "chat",
      inputTokens: 1,
      outputTokens: 1,
      totalCostUsd: 0,
      costSource: "estimated",
      cacheStatus: "skipped",
      budgetStatus: "ok",
      routingReason: "combo",
      status: "success"
    };
    const store: NesaStore = {
      ...defaultStore,
      router: { ...defaultStore.router, providerStrategy: "priority" },
      providers: [
        provider({ id: "a", name: "A", model: "ma", priority: 1 }),
        provider({ id: "b", name: "B", model: "mb", priority: 2 })
      ],
      combos: [combo],
      usage: [usage]
    };
    const decision = chooseProvider(store, { model: "rr-combo", messages: [{ role: "user", content: "hi" }] }, [], combo);
    expect(decision.provider.id).toBe("b");
  });
});
