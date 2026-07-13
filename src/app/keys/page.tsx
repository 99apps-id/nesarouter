import AppShell from "@/components/AppShell";
import KeysManager from "@/components/KeysManager";
import { readStore } from "@/lib/store";
import { keyRows } from "@/lib/keyIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const store = await readStore();
  const keys = keyRows(store.localApiKeys);

  return (
    <AppShell active="keys" eyebrow="Keys" title="Client Keys">
      <KeysManager initialKeys={keys} />
    </AppShell>
  );
}
