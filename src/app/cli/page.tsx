import AppShell from "@/components/AppShell";
import CliPageContent from "@/components/CliPageContent";
import { publicOrigin } from "@/core/publicUrl";
import { keyRows } from "@/lib/keyIdentity";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CliPage() {
  const store = await readStore();
  const baseUrl = publicOrigin(undefined, store.router.publicBaseUrl);

  return (
    <AppShell active="cli">
      <CliPageContent
        baseUrl={baseUrl}
        router={store.router}
        combos={store.combos}
        aliases={store.aliases ?? []}
        providers={store.providers}
        keys={keyRows(store.localApiKeys)}
        comboCount={store.combos.length}
        keyCount={store.localApiKeys.length}
      />
    </AppShell>
  );
}
