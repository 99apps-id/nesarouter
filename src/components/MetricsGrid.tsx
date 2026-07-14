"use client";

import { Activity, Gauge, KeyRound, WalletCards } from "lucide-react";
import { money } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";

export default function MetricsGrid({
  todaySpend,
  remaining,
  activeProviders,
  totalProviders,
  requests
}: {
  todaySpend: number;
  remaining: number;
  activeProviders: number;
  totalProviders: number;
  requests: number;
}) {
  const { t } = useI18n();
  return (
    <section className="metric-grid" aria-label={t.overview.metricsAria}>
      <div className="metric">
        <WalletCards size={20} />
        <span>{t.overview.spendToday}</span>
        <strong>{money(todaySpend)}</strong>
      </div>
      <div className="metric">
        <Gauge size={20} />
        <span>{t.overview.budgetLeft}</span>
        <strong>{money(remaining)}</strong>
      </div>
      <div className="metric">
        <KeyRound size={20} />
        <span>{t.overview.providersActive}</span>
        <strong>
          {activeProviders}/{totalProviders}
        </strong>
      </div>
      <div className="metric">
        <Activity size={20} />
        <span>{t.overview.requests}</span>
        <strong>{requests}</strong>
      </div>
    </section>
  );
}
