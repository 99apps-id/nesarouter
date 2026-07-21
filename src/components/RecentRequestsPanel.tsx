import { UsageLog } from "@/core/types";
import { formatTime, money } from "@/lib/format";
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
          usage.slice(0, 12).map((item) => {
            const skipped = item.skippedProviders?.length ?? 0;
            const skipTitle = item.skippedProviders?.map((s) => `${s.providerId}: ${s.reason}`).join("\n") ?? "";
            return (
              <div className="recent-item" key={item.id}>
                <div className="provider-cell">
                  <ProviderIcon provider={{ providerName: item.providerName, model: item.model }} size="sm" active={item.status === "success"} />
                  <div>
                    <strong>{item.model}</strong>
                    <span>{item.providerName}</span>
                    {skipped > 0 ? (
                      <small className="subtle" title={skipTitle}>
                        {skipped} provider(s) skipped
                      </small>
                    ) : null}
                  </div>
                </div>
                <div>
                  <strong>{money(item.totalCostUsd)}</strong>
                  <span>{formatTime(item.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
