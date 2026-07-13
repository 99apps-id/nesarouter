import { Database, LockKeyhole, Network, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import MetricsGrid from "@/components/MetricsGrid";
import RoutingPolicyPanel from "@/components/RoutingPolicyPanel";
import UsageTable from "@/components/UsageTable";
import { budgetMessage, getBudgetStatus } from "@/core/budget";
import { money } from "@/lib/format";
import { getTodaySpend, getTodaySavings, readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const store = await readStore();
  const todaySpend = getTodaySpend(store);
  const remaining = Math.max(0, store.budget.dailyBudgetUsd - todaySpend);
  const budgetStatus = getBudgetStatus(store);
  const activeProviders = store.providers.filter((provider) => provider.status === "active").length;
  const savings = getTodaySavings(store);
  const savingsBreakdown = [
    savings.cacheSavings > 0 ? `${money(savings.cacheSavings)} via cache` : null,
    savings.freeTierRequests > 0 ? `${savings.freeTierRequests} free-tier req` : null,
    savings.cacheHits > 0 ? `${savings.cacheHits} cache hits` : null
  ].filter(Boolean).join(" · ") || "No savings yet today";

  return (
    <AppShell active="overview" eyebrow="Overview" title="Dashboard">
      <MetricsGrid
        todaySpend={todaySpend}
        remaining={remaining}
        activeProviders={activeProviders}
        totalProviders={store.providers.length}
        requests={store.usage.length}
      />

      {budgetStatus !== "ok" ? (
        <section className={`alert-banner ${budgetStatus}`}>
          <ShieldCheck size={18} />
          <div>
            <strong>Budget guard active</strong>
            <span>{budgetMessage(store.budget, budgetStatus)}</span>
          </div>
        </section>
      ) : null}

      <section className="system-strip" aria-label="System status">
        <span>
          <Database size={15} /> SQLite
        </span>
        <span>
          <LockKeyhole size={15} /> Encrypted keys
        </span>
        <span>
          <Network size={15} /> Fallback ready
        </span>
      </section>

      <section className="split-layout">
        <RoutingPolicyPanel router={store.router} providers={store.providers} />
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="subtle">Savings today</p>
              <h2>{money(savings.cacheSavings)} saved</h2>
            </div>
          </div>
          <p className="compact-copy">{savingsBreakdown}</p>
          <UsageTable usage={store.usage.slice(0, 5)} />
        </section>
      </section>
    </AppShell>
  );
}
