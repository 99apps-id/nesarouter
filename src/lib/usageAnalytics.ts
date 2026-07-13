import { UsageLog } from "@/core/types";

export function usageSummary(usage: UsageLog[]) {
  return usage.reduce(
    (summary, item) => {
      if (item.status === "success") summary.totalRequests += 1;
      summary.inputTokens += item.inputTokens;
      summary.outputTokens += item.outputTokens;
      summary.totalCostUsd += item.totalCostUsd;
      return summary;
    },
    {
      totalRequests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCostUsd: 0
    }
  );
}

export function usageByModel(usage: UsageLog[]) {
  const rows = new Map<
    string,
    {
      model: string;
      providerId: string;
      providerName: string;
      requests: number;
      inputTokens: number;
      outputTokens: number;
      totalCostUsd: number;
      lastUsed: string;
    }
  >();

  for (const item of usage) {
    const key = `${item.providerId}:${item.model}`;
    const existing =
      rows.get(key) ??
      {
        model: item.model,
        providerId: item.providerId,
        providerName: item.providerName,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCostUsd: 0,
        lastUsed: item.createdAt
      };
    existing.requests += item.status === "success" ? 1 : 0;
    existing.inputTokens += item.inputTokens;
    existing.outputTokens += item.outputTokens;
    existing.totalCostUsd += item.totalCostUsd;
    if (item.createdAt > existing.lastUsed) existing.lastUsed = item.createdAt;
    rows.set(key, existing);
  }

  return [...rows.values()].sort((a, b) => b.totalCostUsd - a.totalCostUsd || b.requests - a.requests);
}

export interface UsageStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  cacheHits: number;
  cacheSkipped: number;
  cacheHitRate: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  byProvider: Array<{ providerId: string; providerName: string; requests: number; totalCostUsd: number; inputTokens: number; outputTokens: number }>;
  byModel: Array<{ model: string; providerId: string; providerName: string; requests: number; inputTokens: number; outputTokens: number; totalCostUsd: number; lastUsed: string }>;
  byStatus: Array<{ status: "success" | "error"; count: number }>;
}

export function usageStats(usage: UsageLog[]): UsageStats {
  const byProvider = new Map<string, { providerId: string; providerName: string; requests: number; totalCostUsd: number; inputTokens: number; outputTokens: number }>();
  let successCount = 0;
  let errorCount = 0;
  let cacheHits = 0;
  let cacheSkipped = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCostUsd = 0;

  for (const item of usage) {
    if (item.status === "success") successCount += 1; else errorCount += 1;
    if (item.cacheStatus === "hit") cacheHits += 1;
    if (item.cacheStatus === "skipped") cacheSkipped += 1;
    inputTokens += item.inputTokens;
    outputTokens += item.outputTokens;
    totalCostUsd += item.totalCostUsd;
    const key = item.providerId;
    const row = byProvider.get(key) ?? { providerId: item.providerId, providerName: item.providerName, requests: 0, totalCostUsd: 0, inputTokens: 0, outputTokens: 0 };
    row.requests += 1;
    row.totalCostUsd += item.totalCostUsd;
    row.inputTokens += item.inputTokens;
    row.outputTokens += item.outputTokens;
    byProvider.set(key, row);
  }

  const cacheable = cacheHits + cacheSkipped;
  return {
    totalRequests: successCount + errorCount,
    successCount,
    errorCount,
    cacheHits,
    cacheSkipped,
    cacheHitRate: cacheable ? cacheHits / cacheable : 0,
    inputTokens,
    outputTokens,
    totalCostUsd,
    byProvider: [...byProvider.values()].sort((a, b) => b.requests - a.requests),
    byModel: usageByModel(usage),
    byStatus: [
      { status: "success", count: successCount },
      { status: "error", count: errorCount }
    ]
  };
}

export interface UsageChartPoint {
  date: string;
  requests: number;
  success: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
}

export function usageChart(usage: UsageLog[], days = 14): UsageChartPoint[] {
  const points: UsageChartPoint[] = [];
  const byDate = new Map<string, UsageChartPoint>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const dateKey = d.toISOString().slice(0, 10);
    const point: UsageChartPoint = { date: dateKey, requests: 0, success: 0, errors: 0, inputTokens: 0, outputTokens: 0, totalCostUsd: 0 };
    byDate.set(dateKey, point);
    points.push(point);
  }
  for (const item of usage) {
    const dateKey = item.createdAt.slice(0, 10);
    const point = byDate.get(dateKey);
    if (!point) continue;
    point.requests += 1;
    if (item.status === "success") point.success += 1; else point.errors += 1;
    point.inputTokens += item.inputTokens;
    point.outputTokens += item.outputTokens;
    point.totalCostUsd += item.totalCostUsd;
  }
  return points;
}
