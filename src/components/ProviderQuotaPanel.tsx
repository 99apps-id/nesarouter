import { Gauge } from "lucide-react";
import { ProviderConfig, UsageLog } from "@/core/types";
import { getProviderQuotaState, listKeyQuotaStates, UsageQuotaStore } from "@/core/quota";
import { formatNumber } from "@/lib/format";

export default function ProviderQuotaPanel({
  providers,
  usage
}: {
  providers: ProviderConfig[];
  usage: UsageLog[];
}) {
  const store: UsageQuotaStore = { usage };
  const rows = providers
    .map((provider) => {
      const providerState = getProviderQuotaState(provider, store);
      const keyStates = listKeyQuotaStates(provider, store);
      return { provider, providerState, keyStates };
    })
    .filter((row) => row.providerState || row.keyStates.length);

  if (rows.length === 0) return null;

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">Provider + per-key daily caps</p>
          <h2>Token quotas</h2>
        </div>
        <Gauge size={18} />
      </div>
      <div className="quota-grid">
        {rows.map(({ provider, providerState, keyStates }) => {
          const state = providerState ?? (keyStates.length
            ? {
                used: keyStates.reduce((sum, item) => sum + item.used, 0),
                limit: keyStates.reduce((sum, item) => sum + item.limit, 0),
                remaining: keyStates.reduce((sum, item) => sum + item.remaining, 0),
                exhausted: keyStates.every((item) => item.exhausted)
              }
            : null);
          if (!state) return null;
          const pct = Math.min(100, Math.round((state.used / Math.max(1, state.limit)) * 100));
          const tone = pct >= 100 ? "exceeded" : pct >= 90 ? "critical" : pct >= 70 ? "warning" : "ok";
          return (
            <div key={provider.id} className="quota-row">
              <div className="quota-meta">
                <strong>{provider.name}</strong>
                <span className={`quota-tone ${tone}`}>
                  {formatNumber(state.used)} / {formatNumber(state.limit)} tok ({pct}%)
                </span>
              </div>
              <div className="quota-bar">
                <div className={`quota-fill ${tone}`} style={{ width: `${pct}%` }} />
              </div>
              {keyStates.length > 1 || keyStates.some((item) => item.explicit) ? (
                <div className="quota-key-list">
                  {keyStates.map((keyState) => {
                    const keyPct = Math.min(100, Math.round((keyState.used / Math.max(1, keyState.limit)) * 100));
                    return (
                      <span key={keyState.index} className="subtle">
                        key #{keyState.index + 1}
                        {keyState.explicit ? "" : " (inherit)"}: {formatNumber(keyState.used)}/{formatNumber(keyState.limit)} ({keyPct}%)
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
