"use client";

import { Boxes, Database, Globe, LockKeyhole, Network, ShieldCheck, Waypoints } from "lucide-react";
import { formatMessage } from "@/i18n/types";
import { money } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";

export function OverviewAlerts({
  budgetStatus,
  budgetMessageText
}: {
  budgetStatus: string;
  budgetMessageText: string;
}) {
  const { t } = useI18n();
  if (budgetStatus === "ok") return null;
  return (
    <section className={`alert-banner ${budgetStatus}`}>
      <ShieldCheck size={18} />
      <div>
        <strong>{t.overview.budgetGuardActive}</strong>
        <span>{budgetMessageText}</span>
      </div>
    </section>
  );
}

export type SystemStripItem = {
  id: string;
  label: string;
  ok: boolean;
  icon: "db" | "lock" | "network" | "globe" | "tunnel" | "mcp";
};

const icons = {
  db: Database,
  lock: LockKeyhole,
  network: Network,
  globe: Globe,
  tunnel: Waypoints,
  mcp: Boxes
} as const;

export function OverviewSystemStrip({ items }: { items: SystemStripItem[] }) {
  const { t } = useI18n();
  return (
    <section className="system-strip" aria-label={t.overview.systemStatus}>
      {items.map((item) => {
        const Icon = icons[item.icon];
        return (
          <span key={item.id} className={item.ok ? "ok" : "warn"} title={item.label}>
            <Icon size={15} /> {item.label}
          </span>
        );
      })}
    </section>
  );
}

export function OverviewSavingsPanel({
  savingsCacheUsd,
  freeTierRequests,
  cacheHits,
  children
}: {
  savingsCacheUsd: number;
  freeTierRequests: number;
  cacheHits: number;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const o = t.overview;
  const parts = [
    savingsCacheUsd > 0 ? formatMessage(o.viaCache, { amount: money(savingsCacheUsd) }) : null,
    freeTierRequests > 0 ? formatMessage(o.freeTierReq, { count: freeTierRequests }) : null,
    cacheHits > 0 ? formatMessage(o.cacheHits, { count: cacheHits }) : null
  ].filter(Boolean);
  const breakdown = parts.length ? parts.join(" · ") : o.noSavingsYet;

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">{o.savingsToday}</p>
          <h2>{formatMessage(o.savedAmount, { amount: money(savingsCacheUsd) })}</h2>
        </div>
      </div>
      <p className="compact-copy">{breakdown}</p>
      {children}
    </section>
  );
}
