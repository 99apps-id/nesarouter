import AppShell from "@/components/AppShell";
import AliasesManager from "@/components/AliasesManager";
import CombosManager from "@/components/CombosManager";
import { describeProviderRouteReadiness } from "@/core/router";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CombosPage() {
  const store = await readStore();
  const readiness = Object.fromEntries(
    store.providers.map((provider) => [provider.id, describeProviderRouteReadiness(provider)])
  );
  return (
    <AppShell active="combos">
      <CombosManager combos={store.combos} providers={store.providers} readiness={readiness} />
      <AliasesManager aliases={store.aliases ?? []} providers={store.providers} combos={store.combos} />
    </AppShell>
  );
}
