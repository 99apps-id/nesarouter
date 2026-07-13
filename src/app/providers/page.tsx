import AppShell from "@/components/AppShell";
import NewProviderForm from "@/components/NewProviderForm";
import ProviderCard from "@/components/ProviderCard";
import { providerGroup, providerGroupMeta, ProviderGroupId } from "@/lib/providerGroups";
import { redactProviderForClient } from "@/lib/providerRedact";
import { readStore, seedMissingProviders } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  // Ensure OAuth + new catalog presets appear even after hot-reload.
  seedMissingProviders();
  const store = await readStore();
  const groups: ProviderGroupId[] = ["oauth", "free", "free_tier", "paid"];

  return (
    <AppShell active="providers" eyebrow="Providers" title="Providers">
      <div className="providers-stack">
        <NewProviderForm />
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="subtle">Pool</p>
              <h2>{store.providers.length} providers</h2>
            </div>
          </div>
          <div className="provider-groups">
            {store.providers.length === 0 ? (
              <p className="subtle">No providers yet - add one above.</p>
            ) : (
              groups.map((group) => {
                const providers = store.providers.filter((provider) => providerGroup(provider) === group);
                const meta = providerGroupMeta[group];
                if (!providers.length) return null;
                return (
                  <div className={`provider-group provider-group--${meta.tone}`} key={group}>
                    <div className="provider-group-heading">
                      <strong>{meta.title}</strong>
                      <span>{meta.hint}</span>
                    </div>
                    <div className="provider-list">
                      {providers.map((provider) => {
                        const safe = redactProviderForClient(provider);
                        return (
                          <ProviderCard
                            key={provider.id}
                            provider={{ ...safe, apiKey: "", apiKeys: [] }}
                            hasApiKey={Boolean(provider.apiKey)}
                            hasExtraKeys={Boolean(provider.apiKeys?.length)}
                            hasOAuthToken={Boolean(provider.oauthAccessToken || provider.oauthCopilotToken)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
