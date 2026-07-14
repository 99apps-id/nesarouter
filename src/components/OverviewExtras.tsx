"use client";

import { Database, LockKeyhole, Network, ShieldCheck } from "lucide-react";
import { formatMessage } from "@/i18n/types";
import { useI18n } from "@/components/I18nProvider";
import { money } from "@/lib/format";

export default function OverviewExtras({
  budgetStatus,
  budgetMessageText,
  cacheSavings,
  freeTierRequests,
  cacheHits
}: {
  budgetStatus: string;
  budgetMessageText: string;
  cacheSavings: number;
  freeTierRequests: number;
  cacheHits: number;
}) {
  const { t } = useI18n();
  const o = t.overview;

  const parts = [
    cacheSavings > 0 ? formatMessage(o.viaCache, { amount: money(cacheSavings) }) : null,
    freeTierRequests > 0 ? formatMessage(o.freeTierReq, { count: freeTierRequests }) : null,
    cacheHits > 0 ? formatMessage(o.cacheHits, { count: cacheHits }) : null
  ].filter(Boolean);
  const savingsBreakdown = parts.length ? parts.join(" · ") : o.noSavingsYet;

  return (
    <>
      {budgetStatus !== "ok" ? (
        <section className={`alert-banner ${budgetStatus}`}>
          <ShieldCheck size={18} />
          <div>
            <strong>{o.budgetGuardActive}</strong>
            <span>{budgetMessageText}</span>
          </div>
        </section>
      ) : null}

      <section className="system-strip" aria-label={o.systemStatus}>
        <span>
          <Database size={15} /> {o.sqlite}
        </span>
        <span>
          <LockKeyhole size={15} /> {o.encryptedKeys}
        </span>
        <span>
          <Network size={15} /> {o.fallbackReady}
        </span>
      </section>

      <SavingsHeading amount={money(cacheSavings)} breakdown={savingsBreakdown} />
    </>
  );
}

function SavingsHeading({ amount, breakdown }: { amount: string; breakdown: string }) {
  const { t } = useI18n();
  return (
    <div className="panel-heading">
      <div>
        <p className="subtle">{t.overview.savingsToday}</p>
        <h2>{formatMessage(t.overview.savedAmount, { amount })}</h2>
      </div>
      <p className="compact-copy" style={{ width: "100%", marginTop: 8 }}>
        {breakdown}
      </p>
    </div>
  );
}
