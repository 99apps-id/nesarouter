import AppShell from "@/components/AppShell";
import MetricsGrid from "@/components/MetricsGrid";
import { OverviewAlerts, OverviewSavingsPanel, OverviewSystemStrip, SystemStripItem } from "@/components/OverviewStatus";
import RoutingPolicyPanel from "@/components/RoutingPolicyPanel";
import UsageTable from "@/components/UsageTable";
import { budgetMessage, getBudgetStatus } from "@/core/budget";
import { isCloudflaredRunning } from "@/lib/tunnel/cloudflared";
import {
  getTodaySpend,
  getTodaySavings,
  getTodayRequestCount,
  readMcpServers,
  readStore,
  readTunnelSettings
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildSystemStrip(args: {
  fallbackMode: string;
  cfEnabled: boolean;
  cfRunning: boolean;
  tsEnabled: boolean;
  tsMode: "serve" | "funnel";
  tsUrl: string;
  mcpCount: number;
}): SystemStripItem[] {
  const fallbackOn = args.fallbackMode !== "off";
  let remoteLabel = "Local only";
  let remoteOk = true;
  let remoteIcon: SystemStripItem["icon"] = "globe";

  if (args.cfRunning) {
    remoteLabel = "Cloudflare up";
    remoteIcon = "tunnel";
  } else if (args.cfEnabled) {
    remoteLabel = "Cloudflare down";
    remoteOk = false;
    remoteIcon = "tunnel";
  } else if (args.tsEnabled && args.tsUrl) {
    remoteLabel = args.tsMode === "funnel" ? "Tailscale funnel" : "Tailscale serve";
    remoteIcon = "globe";
  } else if (args.tsEnabled) {
    remoteLabel = "Tailscale down";
    remoteOk = false;
    remoteIcon = "globe";
  }

  return [
    { id: "sqlite", icon: "db", label: "SQLite", ok: true },
    { id: "keys", icon: "lock", label: "Encrypted keys", ok: true },
    { id: "fallback", icon: "network", label: fallbackOn ? "Fallback on" : "Fallback off", ok: fallbackOn },
    { id: "remote", icon: remoteIcon, label: remoteLabel, ok: remoteOk },
    {
      id: "mcp",
      icon: "mcp",
      label: args.mcpCount ? `MCP · ${args.mcpCount}` : "No MCP",
      ok: args.mcpCount > 0
    }
  ];
}

export default async function OverviewPage() {
  const store = await readStore();
  const todaySpend = getTodaySpend(store);
  const remaining = Math.max(0, store.budget.dailyBudgetUsd - todaySpend);
  const budgetStatus = getBudgetStatus(store);
  const activeProviders = store.providers.filter((provider) => provider.status === "active").length;
  const savings = getTodaySavings(store);
  const todayRequests = getTodayRequestCount(store);
  const tunnel = await readTunnelSettings();
  const mcpCount = (await readMcpServers()).length;
  const cfRunning = Boolean(tunnel.enabled && isCloudflaredRunning());
  const systemItems = buildSystemStrip({
    fallbackMode: store.router.fallbackMode ?? "auto",
    cfEnabled: tunnel.enabled,
    cfRunning,
    tsEnabled: tunnel.tailscaleEnabled,
    tsMode: tunnel.tailscaleMode === "funnel" ? "funnel" : "serve",
    tsUrl: tunnel.tailscaleUrl,
    mcpCount
  });

  return (
    <AppShell active="overview">
      <MetricsGrid
        todaySpend={todaySpend}
        remaining={remaining}
        activeProviders={activeProviders}
        totalProviders={store.providers.length}
        requests={todayRequests}
      />

      <OverviewAlerts budgetStatus={budgetStatus} budgetMessageText={budgetMessage(store.budget, budgetStatus)} />
      <OverviewSystemStrip items={systemItems} />

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
