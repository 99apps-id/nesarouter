import AppShell from "@/components/AppShell";
import AliasesManager from "@/components/AliasesManager";
import CombosManager from "@/components/CombosManager";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CombosPage() {
  const store = await readStore();
  return (
    <AppShell active="combos">
      <CombosManager combos={store.combos} providers={store.providers} />
      <AliasesManager aliases={store.aliases ?? []} providers={store.providers} combos={store.combos} />
    </AppShell>
  );
}
