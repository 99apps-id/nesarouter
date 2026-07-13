import AppShell from "@/components/AppShell";
import CliConfigFetcher from "@/components/CliConfigFetcher";
import { publicOrigin } from "@/core/publicUrl";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CliPage() {
  const store = await readStore();
  const baseUrl = publicOrigin(undefined, store.router.publicBaseUrl);

  return (
    <AppShell active="cli" eyebrow="CLI" title="CLI Tools">
      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Semua lewat aplikasi</p>
            <h2>Hubungkan CLI tanpa edit .env / .json</h2>
          </div>
        </div>
        <p className="compact-copy">
          Provider, combo, alias, routing, dan client key dikelola dari dashboard. Wizard di bawah membuat key + config +
          skrip install otomatis. Cukup jalankan skrip PowerShell/Bash sekali di mesin tempat CLI berjalan.
        </p>
        <div className="cli-grid">
          <div>
            <span>Endpoint</span>
            <code>{baseUrl}/v1</code>
          </div>
          <div>
            <span>Combos</span>
            <code>{store.combos.length} configured</code>
          </div>
          <div>
            <span>Fallback</span>
            <code>{store.router.fallbackMode === "off" ? "off" : "auto"}</code>
          </div>
        </div>
      </section>

      <CliConfigFetcher
        baseUrl={baseUrl}
        router={store.router}
        combos={store.combos}
        aliases={store.aliases ?? []}
        providers={store.providers}
      />

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Subscription OAuth</p>
            <h2>Claude / Codex via subscription</h2>
          </div>
        </div>
        <p className="compact-copy">
          Tambah provider preset OAuth di <a href="/providers">Providers</a>, klik <strong>Connect</strong> — token disimpan
          terenkripsi di NesaRouter. CLI wizard di atas tetap pakai endpoint NesaRouter; routing ke subscription terjadi
          otomatis di server.
        </p>
      </section>

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Log</p>
            <h2>Request log</h2>
          </div>
        </div>
        <p className="compact-copy">Semua request CLI tercatat di Usage — provider, cost, cache, fallback.</p>
        <a className="button" href="/usage">
          Open Usage
        </a>
      </section>
    </AppShell>
  );
}
