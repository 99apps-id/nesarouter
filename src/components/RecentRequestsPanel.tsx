import { UsageLog } from "@/core/types";
import { money } from "@/lib/format";
import ProviderIcon from "@/components/ProviderIcon";

export default function RecentRequestsPanel({ usage }: { usage: UsageLog[] }) {
  return (
    <section className="panel recent-panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">Recent</p>
          <h2>Requests</h2>
        </div>
      </div>
      <div className="recent-list">
        {usage.length === 0 ? (
          <div className="empty-state compact-empty">
            <strong>No data</strong>
          </div>
        ) : (
          usage.slice(0, 12).map((item) => (
            <div className="recent-item" key={item.id}>
              <div className="provider-cell">
                <ProviderIcon provider={{ providerName: item.providerName, model: item.model }} size="sm" active={item.status === "success"} />
                <div>
                  <strong>{item.model}</strong>
                  <span>{item.providerName}</span>
                </div>
              </div>
              <div>
                <strong>{money(item.totalCostUsd)}</strong>
                <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
