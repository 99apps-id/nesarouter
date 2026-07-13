import { Gauge } from "lucide-react";
import { ProviderConfig, UsageLog } from "@/core/types";
import { getProviderQuotaState } from "@/core/quota";

export default function ProviderQuotaPanel({
  providers,
  usage
}: {
  providers: ProviderConfig[];
  usage: UsageLog[];
}) {
  const store = { usage } as any;
  const rows = providers
    .map((provider) => ({ provider, state: getProviderQuotaState(provider, store) }))
    .filter((row) => row.state);

  if (rows.length === 0) return null;

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">Per-provider daily caps</p>
          <h2>Token quotas</h2>
        </div>
        <Gauge size={18} />
      </div>
      <div className="quota-grid">
        {rows.map(({ provider, state }) => {
          const pct = state ? Math.min(100, Math.round((state.used / state.limit) * 100)) : 0;
          const tone = pct >= 100 ? "exceeded" : pct >= 90 ? "critical" : pct >= 70 ? "warning" : "ok";
          return (
            <div key={provider.id} className="quota-row">
              <div className="quota-meta">
                <strong>{provider.name}</strong>
                <span className={`quota-tone ${tone}`}>
                  {state!.used.toLocaleString()} / {state!.limit.toLocaleString()} tok ({pct}%)
                </span>
              </div>
              <div className="quota-bar">
                <div className={`quota-fill ${tone}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
