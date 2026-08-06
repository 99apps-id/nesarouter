import { describe, expect, it } from "vitest";
import { providerActivity, routeEvents, routeEventsForProviders } from "@/lib/usageFlow";
import type { ProviderConfig, UsageLog } from "@/core/types";

function usage(overrides: Partial<UsageLog>): UsageLog {
  return {
    id: "req-1",
    createdAt: "2026-07-17T08:00:00.000Z",
    providerId: "provider-a",
    providerName: "Provider A",
    model: "model-a",
    tier: "premium",
    taskType: "chat",
    inputTokens: 10,
    outputTokens: 5,
    totalCostUsd: 0.01,
    costSource: "estimated",
    cacheStatus: "miss",
    budgetStatus: "ok",
    routingReason: "priority",
    status: "success",
    ...overrides
  };
}

function provider(id: string, priority: number): ProviderConfig {
  return {
    id,
    name: id,
    type: "openai_compatible",
    baseUrl: "https://example.com/v1",
    apiKey: "",
    model: `${id}-model`,
    status: "active",
    priority,
    tier: "premium",
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  };
}

describe("usage live routing workbench", () => {
  it("sorts newest first and distinguishes cache from upstream traffic", () => {
    const now = new Date("2026-07-17T08:10:00.000Z").getTime();
    const events = routeEvents([
      usage({ id: "older", createdAt: "2026-07-17T08:01:00.000Z" }),
      usage({ id: "cache", createdAt: "2026-07-17T08:09:00.000Z", cacheStatus: "hit" })
    ], now);
    expect(events.map((row) => row.id)).toEqual(["cache", "older"]);
    expect(events[0]).toMatchObject({ isRecent: true, isUpstream: false });
    expect(events[1]).toMatchObject({ isRecent: true, isUpstream: true });
  });

  it("does not classify old or invalid timestamps as live", () => {
    const now = new Date("2026-07-17T09:00:00.000Z").getTime();
    const events = routeEvents([
      usage({ id: "old", createdAt: "2026-07-17T08:00:00.000Z" }),
      usage({ id: "invalid", createdAt: "not-a-date" })
    ], now);
    expect(events.every((row) => !row.isRecent)).toBe(true);
  });

  it("aggregates only real upstream attempts and ranks used providers first", () => {
    const events = routeEvents([
      usage({ id: "a1", providerId: "a", inputTokens: 10, outputTokens: 5 }),
      usage({ id: "a2", providerId: "a", status: "error", inputTokens: 2, outputTokens: 0 }),
      usage({ id: "cache", providerId: "b", cacheStatus: "hit", inputTokens: 99, outputTokens: 99 })
    ], new Date("2026-07-17T08:05:00.000Z").getTime());
    const rows = providerActivity([provider("b", 1), provider("a", 2)], events);
    expect(rows[0]).toMatchObject({ provider: { id: "a" }, activity: { requests: 2, errors: 1, tokens: 17 } });
    expect(rows[1]).toMatchObject({ provider: { id: "b" }, activity: undefined });
  });

  it("filters providers before applying the live event limit", () => {
    const unrelated = Array.from({ length: 24 }, (_, index) => usage({
      id: `unrelated-${index}`,
      providerId: "disabled",
      providerName: "Disabled",
      createdAt: `2026-07-17T08:${String(30 + index).padStart(2, "0")}:00.000Z`
    }));
    const matching = usage({ id: "matching", providerId: "active", providerName: "Active", createdAt: "2026-07-17T08:01:00.000Z" });
    expect(routeEventsForProviders([...unrelated, matching], [provider("active", 1)], new Date("2026-07-17T09:00:00.000Z").getTime()).map((row) => row.id)).toContain("matching");
  });

  it("attributes activity when an event uses the provider name instead of its id", () => {
    const named = provider("provider-id", 1);
    named.name = "Provider Name";
    const events = routeEvents([usage({ providerId: "legacy-id", providerName: "Provider Name" })], new Date("2026-07-17T08:05:00.000Z").getTime());
    expect(providerActivity([named], events)[0].activity?.requests).toBe(1);
  });
});
