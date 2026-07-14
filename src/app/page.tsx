import AppShell from "@/components/AppShell";
import MetricsGrid from "@/components/MetricsGrid";
import { OverviewAlerts, OverviewSavingsPanel, OverviewSystemStrip } from "@/components/OverviewStatus";
import RoutingPolicyPanel from "@/components/RoutingPolicyPanel";
import UsageTable from "@/components/UsageTable";
import { budgetMessage, getBudgetStatus } from "@/core/budget";
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

  return (
    <AppShell active="overview">
      <MetricsGrid
        todaySpend={todaySpend}
        remaining={remaining}
        activeProviders={activeProviders}
        totalProviders={store.providers.length}
        requests={store.usage.length}
      />

      <OverviewAlerts budgetStatus={budgetStatus} budgetMessageText={budgetMessage(store.budget, budgetStatus)} />
      <OverviewSystemStrip />

      <section className="split-layout">
        <RoutingPolicyPanel router={store.router} providers={store.providers} />
        <OverviewSavingsPanel
          savingsCacheUsd={savings.cacheSavings}
          freeTierRequests={savings.freeTierRequests}
          cacheHits={savings.cacheHits}
        >
          <UsageTable usage={store.usage.slice(0, 5)} />
        </OverviewSavingsPanel>
      </section>
    </AppShell>
  );
}
