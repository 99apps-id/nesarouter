import { money, formatNumber, formatTime } from "@/lib/format";
import ProviderIcon from "@/components/ProviderIcon";

export interface UsageByModelRow {
  model: string;
  providerId: string;
  providerName: string;
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
      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>No usage recorded.</strong>
        </div>
      ) : (
        <div className="usage-agg-wrap">
          <table className="usage-agg-table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Provider</th>
                <th scope="col" className="num">Req</th>
                <th scope="col" className="num">Input</th>
                <th scope="col" className="num">Output</th>
                <th scope="col" className="num">Cost</th>
                <th scope="col" className="num">Last</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.providerId}:${row.model}`}>
                  <td className="usage-agg-model" title={row.model}>
                    {row.model}
                  </td>
                  <td>
                    <span className="provider-cell">
                      <ProviderIcon provider={{ providerName: row.providerName, model: row.model }} size="sm" active />
                      <span title={row.providerName}>{row.providerName}</span>
                    </span>
                  </td>
                  <td className="num">{formatNumber(row.requests)}</td>
                  <td className="num">{formatNumber(row.inputTokens)}</td>
                  <td className="num">{formatNumber(row.outputTokens)}</td>
                  <td className="num">{money(row.totalCostUsd)}</td>
                  <td className="num">{formatTime(row.lastUsed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
