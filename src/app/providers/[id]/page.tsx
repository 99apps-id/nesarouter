import AppShell from "@/components/AppShell";
import ProviderDetail from "@/components/ProviderDetail";
import { providerPresets } from "@/lib/providerPresets";
import { keyPreview, tierLabel } from "@/lib/providerLabels";
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
        hasOAuthToken={Boolean(provider.oauthAccessToken ?? provider.oauthCopilotToken)}
        tierLabel={`${tierLabel[provider.tier]} · ${provider.type}`}
        canDelete={!presetIds.has(provider.id)}
      />
    </AppShell>
  );
}
