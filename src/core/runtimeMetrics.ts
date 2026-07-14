import { getGateSnapshot } from "@/core/requestGate";
import type { NesaStore } from "@/core/types";
import { getTodaySpend } from "@/lib/store";

const counters = {
  requestsTotal: 0,
  errorsTotal: 0,
  cacheHitsTotal: 0,
  queueTimeoutsTotal: 0
};

export function recordRequest() {
  counters.requestsTotal += 1;
}

export function recordError() {
  counters.errorsTotal += 1;
}

export function recordCacheHit() {
  counters.cacheHitsTotal += 1;
}

export function recordQueueTimeout() {
  counters.queueTimeoutsTotal += 1;
}

export function getRuntimeCounters() {
  return { ...counters };
}

/** Test helper */
export function resetRuntimeMetricsForTests() {
  counters.requestsTotal = 0;
  counters.errorsTotal = 0;
  counters.cacheHitsTotal = 0;
  counters.queueTimeoutsTotal = 0;
}

export function renderPrometheusText(store: NesaStore): string {
  const gate = getGateSnapshot();
  const active = store.providers.filter((p) => p.status === "active").length;
  const cooldown = store.providers.filter((p) => p.status === "cooldown").length;
  const spent = getTodaySpend(store);
  const lines = [
    "# HELP nesa_up NesaRouter process is up.",
    "# TYPE nesa_up gauge",
    "nesa_up 1",
    "# HELP nesa_uptime_seconds Process uptime in seconds.",
    "# TYPE nesa_uptime_seconds gauge",
    `nesa_uptime_seconds ${Math.floor(process.uptime())}`,
    "# HELP nesa_requests_total Chat completion requests accepted by the pipeline.",
    "# TYPE nesa_requests_total counter",
    `nesa_requests_total ${counters.requestsTotal}`,
    "# HELP nesa_errors_total Chat pipeline error responses (auth excluded).",
    "# TYPE nesa_errors_total counter",
    `nesa_errors_total ${counters.errorsTotal}`,
    "# HELP nesa_cache_hits_total Cache hit responses.",
    "# TYPE nesa_cache_hits_total counter",
    `nesa_cache_hits_total ${counters.cacheHitsTotal}`,
    "# HELP nesa_queue_timeouts_total Upstream concurrency queue timeouts.",
    "# TYPE nesa_queue_timeouts_total counter",
    `nesa_queue_timeouts_total ${counters.queueTimeoutsTotal}`,
    "# HELP nesa_upstream_in_flight Current upstream calls holding a gate slot.",
    "# TYPE nesa_upstream_in_flight gauge",
    `nesa_upstream_in_flight ${gate.inFlight}`,
    "# HELP nesa_upstream_queue_waiting Requests waiting for a concurrency slot.",
    "# TYPE nesa_upstream_queue_waiting gauge",
    `nesa_upstream_queue_waiting ${gate.waiting}`,
    "# HELP nesa_providers_active Active providers.",
    "# TYPE nesa_providers_active gauge",
    `nesa_providers_active ${active}`,
    "# HELP nesa_providers_cooldown Providers currently in cooldown.",
    "# TYPE nesa_providers_cooldown gauge",
    `nesa_providers_cooldown ${cooldown}`,
    "# HELP nesa_budget_spent_usd Today spend in USD (successful usage).",
    "# TYPE nesa_budget_spent_usd gauge",
    `nesa_budget_spent_usd ${spent}`
  ];
  return `${lines.join("\n")}\n`;
}
