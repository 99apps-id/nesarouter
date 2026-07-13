import { money } from "@/lib/format";
import ProviderIcon from "@/components/ProviderIcon";

export interface UsageByModelRow {
  model: string;
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  lastUsed: string;
}

export default function UsageByModelTable({ rows }: { rows: UsageByModelRow[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">Models</p>
          <h2>Usage by model</h2>
        </div>
      </div>
      <div className="model-table">
        <div className="model-row header">
          <span>Model</span>
          <span>Provider</span>
          <span>Req</span>
          <span>Input</span>
          <span>Output</span>
          <span>Cost</span>
          <span>Last</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state">
            <strong>No usage recorded.</strong>
          </div>
        ) : (
          rows.map((row) => (
            <div className="model-row" key={`${row.provider}:${row.model}`}>
              <span>{row.model}</span>
              <span className="provider-cell">
                <ProviderIcon provider={{ providerName: row.provider, model: row.model }} size="sm" active />
                <span>{row.provider}</span>
              </span>
              <span>{row.requests}</span>
              <span>{row.inputTokens.toLocaleString()}</span>
              <span>{row.outputTokens.toLocaleString()}</span>
              <span>{money(row.totalCostUsd)}</span>
              <span>{new Date(row.lastUsed).toLocaleTimeString()}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
