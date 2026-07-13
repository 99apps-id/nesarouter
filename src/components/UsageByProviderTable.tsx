import { money } from "@/lib/format";
import ProviderIcon from "@/components/ProviderIcon";

export interface UsageByProviderRow {
  providerId: string;
  providerName: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
}

export default function UsageByProviderTable({ rows }: { rows: UsageByProviderRow[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">Providers</p>
          <h2>Usage by provider</h2>
        </div>
      </div>
      <div className="model-table">
        <div className="model-row header">
          <span>Provider</span>
          <span>Req</span>
          <span>Input</span>
          <span>Output</span>
          <span>Cost</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state">
            <strong>No provider usage recorded.</strong>
          </div>
        ) : (
          rows.map((row) => (
            <div className="model-row provider-usage-row" key={row.providerId}>
              <span className="provider-cell">
                <ProviderIcon provider={{ id: row.providerId, name: row.providerName, providerName: row.providerName }} size="sm" active />
                <span>{row.providerName}</span>
              </span>
              <span>{row.requests}</span>
              <span>{row.inputTokens.toLocaleString()}</span>
              <span>{row.outputTokens.toLocaleString()}</span>
              <span>{money(row.totalCostUsd)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
