"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { money, formatNumber, formatTime } from "@/lib/format";

interface UsageStatsPayload {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  cacheHitRate: number;
  byProvider: Array<{
    providerId: string;
    providerName: string;
    requests: number;
    totalCostUsd: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  byModel: Array<{
    model: string;
    providerName: string;
    requests: number;
    totalCostUsd: number;
  }>;
}

export default function UsageLivePanel() {
  const [stats, setStats] = useState<UsageStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  async function load() {
    const response = await fetch("/api/usage/stats", { credentials: "include" }).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json()) as UsageStatsPayload;
    setStats(payload);
    setUpdatedAt(formatTime(new Date()));
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await load();
    };
    tick();
    const timer = window.setInterval(tick, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="panel compact usage-live-panel">
      <div className="panel-heading">
        <div>
          <h2>Usage</h2>
        </div>
        <button className="icon-button" type="button" onClick={load} aria-label="Refresh usage stats">
          <RefreshCw size={15} />
        </button>
      </div>
      {loading && !stats ? <p className="subtle">Loading…</p> : null}
      {stats ? (
        <>
          <div className="usage-live-meta">
            <span>
              <Activity size={14} /> {stats.totalRequests} req
            </span>
            <span>{formatNumber(stats.inputTokens)} in</span>
            <span>{formatNumber(stats.outputTokens)} out</span>
            <span>{money(stats.totalCostUsd)}</span>
            <span>{Math.round(stats.cacheHitRate * 100)}% cache</span>
            {updatedAt ? <span className="subtle">Updated {updatedAt}</span> : null}
          </div>
          <div className="usage-live-grid">
            <div>
              <h3>Provider</h3>
              {stats.byProvider.length === 0 ? (
                <p className="subtle">No provider traffic yet.</p>
              ) : (
                stats.byProvider.slice(0, 8).map((row) => (
                  <div className="usage-live-row" key={row.providerId}>
                    <strong>{row.providerName}</strong>
                    <span>{row.requests} req</span>
                    <span>{money(row.totalCostUsd)}</span>
                  </div>
                ))
              )}
            </div>
            <div>
              <h3>Model</h3>
              {stats.byModel.length === 0 ? (
                <p className="subtle">No model traffic yet.</p>
              ) : (
                stats.byModel.slice(0, 8).map((row) => (
                  <div className="usage-live-row" key={`${row.providerName}:${row.model}`}>
                    <strong>{row.model}</strong>
                    <span>{row.providerName}</span>
                    <span>{row.requests} req</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
