import AppShell from "@/components/AppShell";
import ProviderDetail from "@/components/ProviderDetail";
import { providerPresets } from "@/lib/providerPresets";
import { keyPreview, tierLabel } from "@/lib/providerLabels";
import { configuredOAuthAccounts, oauthAccountCount, routableOAuthAccountCount } from "@/core/oauthAccounts";
import { oauthAccountStatusLabel } from "@/core/oauthAccountHealth";
import { redactProviderForClient } from "@/lib/providerRedact";
import { readStore } from "@/lib/store";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await readStore();
  const provider = store.providers.find((item) => item.id === id);
  if (!provider) notFound();

  const presetIds = new Set(providerPresets.map((preset) => preset.id));
  const keyPreviews: string[] = [
    ...(provider.apiKey ? [keyPreview(provider.apiKey)] : []),
    ...(Array.isArray(provider.apiKeys) ? provider.apiKeys.map((key) => keyPreview(key)) : [])
  ];
  const safeProvider = redactProviderForClient(provider);
  const oauthAccountSummaries = configuredOAuthAccounts(provider).map((account) => {
    const status = oauthAccountStatusLabel(account);
    return {
      id: account.id,
      name: account.name ?? `Account ${account.index + 1}`,
      connected: Boolean(account.oauthAccessToken || account.oauthCopilotToken),
      status,
      lastError: account.lastError,
      lastCheckedAt: account.lastCheckedAt,
      routable: Boolean((account.oauthAccessToken || account.oauthCopilotToken) && account.connectionStatus !== "error")
    };
  });

  return (
    <AppShell active="providers" eyebrow="Provider" title={provider.name}>
      <ProviderDetail
        provider={{
          ...safeProvider,
          apiKey: "",
          apiKeys: []
        }}
        keyPreviews={keyPreviews}
        keyCount={keyPreviews.length}
        hasApiKey={Boolean(provider.apiKey)}
        hasOAuthToken={oauthAccountCount(provider) > 0}
        routableOAuthCount={routableOAuthAccountCount(provider)}
        oauthAccountSummaries={oauthAccountSummaries}
        tierLabel={`${tierLabel[provider.tier]} · ${provider.type}`}
        canDelete={!presetIds.has(provider.id)}
      />
    </AppShell>
  );
}
