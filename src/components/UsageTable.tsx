import { UsageLog } from "@/core/types";
import { money } from "@/lib/format";
import ProviderIcon from "@/components/ProviderIcon";

export default function UsageTable({ usage }: { usage: UsageLog[] }) {
  return (
    <div className="usage-table" role="table" aria-label="Usage logs">
      <div className="usage-row header" role="row">
        <span>Time</span>
        <span>Provider</span>
        <span>Task</span>
        <span>Cost</span>
        <span>Source</span>
        <span>Status</span>
      </div>
      {usage.length === 0 ? (
        <div className="empty-state">
          <strong>No requests yet</strong>
          <span>Send a request to `/v1/chat/completions`.</span>
        </div>
      ) : (
        usage.map((item) => (
          <div className="usage-row" role="row" key={item.id}>
            <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
            <span className="provider-cell">
              <ProviderIcon provider={{ providerName: item.providerName, model: item.model }} size="sm" active={item.status === "success"} />
              <span className="usage-provider-copy">
                <span>{item.providerName}</span>
                <small>{item.taskType}</small>
              </span>
            </span>
            <span>{item.taskType}</span>
            <span>{money(item.totalCostUsd)}</span>
            <span>{item.costSource}</span>
            <span className={`status ${item.status}`} title={item.routingReason}>
              {item.status}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
