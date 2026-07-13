import AppShell from "@/components/AppShell";
import HeadroomPanel from "@/components/HeadroomPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HeadroomPage() {
  return (
    <AppShell active="headroom" eyebrow="Compression proxy" title="Headroom">
      <HeadroomPanel />
    </AppShell>
  );
}
