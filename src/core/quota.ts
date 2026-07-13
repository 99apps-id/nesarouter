import { NesaStore, ProviderConfig } from "@/core/types";
import { todayKey } from "@/lib/store";

export interface ProviderQuotaState {
  limit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
}

export function getProviderQuotaUsedToday(provider: ProviderConfig, store: NesaStore): number {
  const today = todayKey();
  return store.usage
    .filter(
      (item) =>
        item.createdAt.startsWith(today) &&
        item.providerId === provider.id &&
        item.status === "success"
    )
    .reduce((sum, item) => sum + item.inputTokens + item.outputTokens, 0);
}

export function getProviderQuotaState(provider: ProviderConfig, store: NesaStore): ProviderQuotaState | null {
  const limit = Number(provider.quotaLimitTokens ?? 0);
  if (!limit || limit <= 0) return null;
  const used = getProviderQuotaUsedToday(provider, store);
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining, exhausted: remaining <= 0 };
}

export function providerQuotaReason(state: ProviderQuotaState): string {
  return `Daily token quota exhausted (${state.used}/${state.limit}).`;
}
