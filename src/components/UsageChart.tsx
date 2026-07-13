"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

interface ChartPoint {
  date: string;
  requests: number;
  success: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
}

export default function UsageChart() {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage/chart?days=14")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.points) return;
        setPoints(data.points);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const maxRequests = Math.max(1, ...points.map((p) => p.requests));
  const totalRequests = points.reduce((sum, p) => sum + p.requests, 0);
  const totalCost = points.reduce((sum, p) => sum + p.totalCostUsd, 0);

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">Last 14 days</p>
          <h2>Request volume</h2>
        </div>
        <TrendingUp size={18} />
      </div>
      {loading ? (
        <p className="subtle">Loading…</p>
      ) : points.length === 0 ? (
        <p className="subtle">No data yet.</p>
      ) : (
        <>
          <div className="chart-meta">
            <span><strong>{totalRequests}</strong> requests</span>
            <span><strong>${totalCost.toFixed(4)}</strong> spend</span>
          </div>
          <div className="chart-bars" role="img" aria-label="daily request volume">
            {points.map((p) => {
              const heightPct = Math.round((p.requests / maxRequests) * 100);
              const errPct = p.requests ? Math.round((p.errors / p.requests) * 100) : 0;
              return (
                <div key={p.date} className="chart-bar-col" title={`${p.date}: ${p.requests} req, ${p.errors} err, $${p.totalCostUsd.toFixed(4)}`}>
                  <div className="chart-bar-track">
                    <div
                      className={`chart-bar-fill ${errPct > 20 ? "with-errors" : ""}`}
                      style={{ height: `${Math.max(2, heightPct)}%` }}
                    />
                  </div>
                  <small>{p.date.slice(5)}</small>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
