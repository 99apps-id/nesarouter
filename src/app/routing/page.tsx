import AppShell from "@/components/AppShell";
import AdminPasswordPanel from "@/components/AdminPasswordPanel";
import RoutingPolicyPanel from "@/components/RoutingPolicyPanel";
import SettingsPanel from "@/components/SettingsPanel";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RoutingPage() {
  const store = await readStore();

  return (
    <AppShell active="routing">
      <section className="split-layout">
        <SettingsPanel budget={store.budget} router={store.router} providers={store.providers} />
        <RoutingPolicyPanel router={store.router} providers={store.providers} />
      </section>
      <AdminPasswordPanel />
    </AppShell>
  );
}
