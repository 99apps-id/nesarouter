import AppShell from "@/components/AppShell";
import ProviderQuotaPanel from "@/components/ProviderQuotaPanel";
import UsageByProviderTable from "@/components/UsageByProviderTable";
import UsageChart from "@/components/UsageChart";
import UsageFlow from "@/components/UsageFlow";
import UsageByModelTable from "@/components/UsageByModelTable";
import UsageLivePanel from "@/components/UsageLivePanel";
import UsageSummaryCards from "@/components/UsageSummaryCards";
import UsageTable from "@/components/UsageTable";
import { readStore } from "@/lib/store";
import { usageByModel, usageStats, usageSummary } from "@/lib/usageAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const store = await readStore();
  const summary = usageSummary(store.usage);
  const modelRows = usageByModel(store.usage);
  const stats = usageStats(store.usage);

  return (
    <AppShell active="usage">
      <UsageSummaryCards {...summary} />
      <UsageLivePanel />
      <UsageChart />
      <ProviderQuotaPanel providers={store.providers} usage={store.usage} />
      <UsageFlow providers={store.providers} usage={store.usage} />
      <section className="usage-agg-grid">
        <UsageByProviderTable rows={stats.byProvider} />
        <UsageByModelTable rows={modelRows} />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Requests</h2>
          </div>
        </div>
        <UsageTable usage={store.usage.slice(0, 100)} />
      </section>
    </AppShell>
  );
}
