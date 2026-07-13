import AppShell from "@/components/AppShell";
import TunnelPanel from "@/components/TunnelPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TunnelPage() {
  return (
    <AppShell active="tunnel" eyebrow="Remote access" title="Tunnel">
      <TunnelPanel />
    </AppShell>
  );
}
