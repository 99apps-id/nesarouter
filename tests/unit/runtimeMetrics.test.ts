import { afterEach, describe, expect, it } from "vitest";
import {
  getRuntimeCounters,
  recordCacheHit,
  recordError,
  recordQueueTimeout,
  recordRequest,
  renderPrometheusText,
  resetRuntimeMetricsForTests
} from "@/core/runtimeMetrics";
import { resetGateForTests } from "@/core/requestGate";
import type { NesaStore } from "@/core/types";
import { defaultStore } from "@/lib/defaults";

afterEach(() => {
  resetRuntimeMetricsForTests();
  resetGateForTests();
});

describe("runtimeMetrics", () => {
  it("counts request / error / cache / queue events", () => {
    recordRequest();
    recordRequest();
    recordError();
    recordCacheHit();
    recordQueueTimeout();
    expect(getRuntimeCounters()).toEqual({
      requestsTotal: 2,
      errorsTotal: 1,
      cacheHitsTotal: 1,
      queueTimeoutsTotal: 1
    });
  });

  it("renders prometheus metric names", () => {
    recordRequest();
    const store: NesaStore = {
      ...defaultStore,
      providers: defaultStore.providers.map((p, i) =>
        i === 0 ? { ...p, status: "cooldown" as const } : p
      ),
      usage: [
        {
          id: "u1",
          createdAt: new Date().toISOString(),
          providerId: "x",
          providerName: "X",
          model: "m",
          tier: "free",
          taskType: "chat",
          inputTokens: 1,
          outputTokens: 1,
          totalCostUsd: 0.12,
          costSource: "estimated",
          cacheStatus: "miss",
          budgetStatus: "ok",
          routingReason: "t",
          status: "success"
        }
      ]
    };
    const text = renderPrometheusText(store);
    expect(text).toContain("nesa_up 1");
    expect(text).toContain("nesa_requests_total 1");
    expect(text).toContain("nesa_upstream_in_flight");
    expect(text).toContain("nesa_providers_active");
    expect(text).toContain("nesa_budget_spent_usd");
  });
});
