import { ChevronRight } from "lucide-react";
import { UsageLog } from "@/core/types";
import { money, formatTime } from "@/lib/format";
import ProviderIcon from "@/components/ProviderIcon";

export default function RequestInspector({ usage }: { usage: UsageLog[] }) {
  const rows = usage.slice(0, 20);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">Audit</p>
          <h2>Request inspector</h2>
        </div>
      </div>
      <p className="compact-copy">
        Per-request audit trail: routing reason, skipped providers, budget status, and error detail.
      </p>
      <div className="inspector-list">
        {rows.length === 0 ? (
          <div className="empty-state compact-empty">
            <strong>No requests yet</strong>
          </div>
        ) : (
          rows.map((item) => {
            const skipped = item.skippedProviders ?? [];
            return (
              <details key={item.id} className="inspector-row">
                <summary className="inspector-summary">
                  <ChevronRight size={14} className="inspector-chevron" />
                  <span className="inspector-time">{formatTime(item.createdAt)}</span>
                  <span className="provider-cell">
                    <ProviderIcon
                      provider={{ providerName: item.providerName, model: item.model }}
                      size="sm"
                      active={item.status === "success"}
                    />
                    <span>{item.providerName}</span>
                  </span>
                  <span className="inspector-model">{item.model}</span>
                  <span className={`status ${item.status}`}>{item.status}</span>
                  <span className="inspector-cost">{money(item.totalCostUsd)}</span>
                  <span className="inspector-source">{item.costSource}</span>
                </summary>
                <div className="inspector-detail">
                  <dl className="inspector-grid">
                    <div>
                      <dt>Tier</dt>
                      <dd>{item.tier}</dd>
                    </div>
                    <div>
                      <dt>Task</dt>
                      <dd>{item.taskType}</dd>
                    </div>
                    <div>
                      <dt>Tokens</dt>
                      <dd>{item.inputTokens} in / {item.outputTokens} out</dd>
                    </div>
                    <div>
                      <dt>Cache</dt>
                      <dd>{item.cacheStatus}</dd>
                    </div>
                    <div>
                      <dt>Budget</dt>
                      <dd>{item.budgetStatus}</dd>
                    </div>
                    <div>
                      <dt>Cost source</dt>
                      <dd>{item.costSource}</dd>
                    </div>
                  </dl>
                  <div className="inspector-section">
                    <p className="subtle">Routing reason</p>
                    <p className="inspector-reason">{item.routingReason}</p>
                  </div>
                  {skipped.length > 0 ? (
                    <div className="inspector-section">
                      <p className="subtle">Skipped providers ({skipped.length})</p>
                      <ul className="inspector-skipped">
                        {skipped.map((skip) => (
                          <li key={skip.providerId}>
                            <code>{skip.providerId}</code>
                            <span>{skip.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {item.error ? (
                    <div className="inspector-section">
                      <p className="subtle">Error</p>
                      <p className="inspector-error">{item.error}</p>
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}
