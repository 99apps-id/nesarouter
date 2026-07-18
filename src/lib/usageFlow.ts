import type { ProviderConfig, UsageLog } from "@/core/types";

export const LIVE_WINDOW_MS = 10 * 60_000;
export const MAX_ROUTE_EVENTS = 24;

export type RouteEvent = UsageLog & { ageMs: number; isRecent: boolean; isUpstream: boolean };

export function routeEvents(usage: UsageLog[], nowMs = Date.now()): RouteEvent[] {
  return usage
    .map((row) => {
      const created = new Date(row.createdAt).getTime();
      const ageMs = Number.isFinite(created) ? Math.max(0, nowMs - created) : Number.POSITIVE_INFINITY;
      return { ...row, ageMs, isRecent: ageMs <= LIVE_WINDOW_MS, isUpstream: row.cacheStatus !== "hit" };
    })
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })
    .slice(0, MAX_ROUTE_EVENTS);
}

export function routeEventsForProviders(usage: UsageLog[], providers: ProviderConfig[], nowMs = Date.now()): RouteEvent[] {
  const providerIds = new Set(providers.map((provider) => provider.id));
  const providerNames = new Set(providers.map((provider) => provider.name));
  return routeEvents(
    usage.filter((row) => providerIds.has(row.providerId) || providerNames.has(row.providerName)),
    nowMs
  );
}

export function providerActivity(providers: ProviderConfig[], events: RouteEvent[]) {
  const traffic = new Map<string, { requests: number; errors: number; tokens: number; lastAt?: string }>();
  for (const row of events) {
    if (!row.isUpstream) continue;
    const matchedProvider = providers.find((provider) => provider.id === row.providerId || provider.name === row.providerName);
    if (!matchedProvider) continue;
    const current = traffic.get(matchedProvider.id) ?? { requests: 0, errors: 0, tokens: 0 };
    current.requests += 1;
    current.errors += row.status === "error" ? 1 : 0;
    current.tokens += row.inputTokens + row.outputTokens;
    current.lastAt ??= row.createdAt;
    traffic.set(matchedProvider.id, current);
  }
  return providers
    .map((provider) => ({ provider, activity: traffic.get(provider.id) }))
    .sort((a, b) => (b.activity?.requests ?? 0) - (a.activity?.requests ?? 0) || a.provider.priority - b.provider.priority);
}
