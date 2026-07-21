import { formatNumber, money } from "@/lib/format";
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
      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>No provider usage recorded.</strong>
        </div>
      ) : (
        <div className="usage-agg-wrap">
          <table className="usage-agg-table">
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col" className="num">Req</th>
                <th scope="col" className="num">Input</th>
                <th scope="col" className="num">Output</th>
                <th scope="col" className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.providerId}>
                  <td>
                    <span className="provider-cell">
                      <ProviderIcon
                        provider={{ id: row.providerId, name: row.providerName, providerName: row.providerName }}
                        size="sm"
                        active
                      />
                      <span title={row.providerName}>{row.providerName}</span>
                    </span>
                  </td>
                  <td className="num">{formatNumber(row.requests)}</td>
                  <td className="num">{formatNumber(row.inputTokens)}</td>
                  <td className="num">{formatNumber(row.outputTokens)}</td>
                  <td className="num">{money(row.totalCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
