import { BudgetSettings, NesaStore, UsageLog } from "@/core/types";
import { getTodaySpend } from "@/lib/store";

export function getBudgetStatus(store: NesaStore, estimatedAdditionalCost = 0): UsageLog["budgetStatus"] {
  const spend = getTodaySpend(store) + estimatedAdditionalCost;
  const budget = store.budget.dailyBudgetUsd;
  if (budget <= 0) return "ok";
  const usedPercent = (spend / budget) * 100;
  if (usedPercent >= store.budget.hardLimitPercent) return "exceeded";
  if (usedPercent >= store.budget.criticalThresholdPercent) return "critical";
  if (usedPercent >= store.budget.warningThresholdPercent) return "warning";
  return "ok";
}

export function budgetMessage(settings: BudgetSettings, status: UsageLog["budgetStatus"]) {
  if (status === "exceeded") {
    return settings.onExceeded === "block_paid"
      ? "Hard limit reached. Paid providers are blocked."
      : "Hard limit reached. Requests are allowed with a warning.";
  }
  if (status === "critical") {
    return settings.onCritical === "free_tier_only"
      ? "Budget is critical. Only free and free-tier providers are allowed."
      : "Budget is critical. Cheaper providers are preferred.";
  }
  if (status === "warning") {
    return settings.onWarning === "prefer_cheaper"
      ? "Budget warning active. Cheaper providers are preferred."
      : "Budget warning active.";
  }
  return "Budget is within limit.";
}
