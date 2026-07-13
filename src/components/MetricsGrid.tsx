import { Activity, Gauge, KeyRound, WalletCards } from "lucide-react";
import { money } from "@/lib/format";

export default function MetricsGrid({
  todaySpend,
  remaining,
  activeProviders,
  totalProviders,
  requests
}: {
  todaySpend: number;
  remaining: number;
  activeProviders: number;
  totalProviders: number;
  requests: number;
}) {
  return (
    <section className="metric-grid" aria-label="Overview metrics">
      <div className="metric">
        <WalletCards size={20} />
        <span>Spend today</span>
        <strong>{money(todaySpend)}</strong>
      </div>
      <div className="metric">
        <Gauge size={20} />
        <span>Budget left</span>
        <strong>{money(remaining)}</strong>
      </div>
      <div className="metric">
        <KeyRound size={20} />
        <span>Providers active</span>
        <strong>
          {activeProviders}/{totalProviders}
        </strong>
      </div>
      <div className="metric">
        <Activity size={20} />
        <span>Requests</span>
        <strong>{requests}</strong>
      </div>
    </section>
  );
}
