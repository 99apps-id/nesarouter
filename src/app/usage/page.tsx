import AppShell from "@/components/AppShell";
import ProviderQuotaPanel from "@/components/ProviderQuotaPanel";
import RecentRequestsPanel from "@/components/RecentRequestsPanel";
import RequestInspector from "@/components/RequestInspector";
import UsageChart from "@/components/UsageChart";
import UsageFlow from "@/components/UsageFlow";
import UsageByModelTable from "@/components/UsageByModelTable";
import UsageSummaryCards from "@/components/UsageSummaryCards";
import UsageTable from "@/components/UsageTable";
import { readStore } from "@/lib/store";
import { usageByModel, usageSummary } from "@/lib/usageAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const store = await readStore();
  const summary = usageSummary(store.usage);
  const modelRows = usageByModel(store.usage);

  return (
    <AppShell active="usage" eyebrow="Usage" title="Usage">
      <UsageSummaryCards {...summary} />
      <UsageChart />
      <ProviderQuotaPanel providers={store.providers} usage={store.usage} />
      <section className="usage-map-grid">
        <UsageFlow providers={store.providers} latestProviderId={store.usage[0]?.providerId} />
        <RecentRequestsPanel usage={store.usage} />
      </section>
      <RequestInspector usage={store.usage} />
      <UsageByModelTable rows={modelRows} />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="subtle">Audit</p>
            <h2>Requests</h2>
          </div>
        </div>
        <UsageTable usage={store.usage.slice(0, 100)} />
      </section>
    </AppShell>
  );
}
