import { Activity, Coins, Download, Upload } from "lucide-react";
import { money } from "@/lib/format";

export default function UsageSummaryCards({
  totalRequests,
  inputTokens,
  outputTokens,
  totalCostUsd
}: {
  totalRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
}) {
  return (
    <section className="metric-grid usage-summary-grid" aria-label="Usage summary">
      <div className="metric">
        <Activity size={20} />
        <span>Requests</span>
        <strong>{totalRequests}</strong>
      </div>
      <div className="metric">
        <Upload size={20} />
        <span>Input tokens</span>
        <strong>{inputTokens.toLocaleString("en-US")}</strong>
      </div>
      <div className="metric">
        <Download size={20} />
        <span>Output tokens</span>
        <strong>{outputTokens.toLocaleString("en-US")}</strong>
      </div>
      <div className="metric">
        <Coins size={20} />
        <span>Est. cost</span>
        <strong>{money(totalCostUsd)}</strong>
      </div>
    </section>
  );
}
