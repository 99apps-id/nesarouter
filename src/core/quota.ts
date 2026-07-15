import { NesaStore, ProviderConfig } from "@/core/types";
import { todayKey, usageDayKey } from "@/lib/store";

export type UsageQuotaStore = Pick<NesaStore, "usage">;

export interface ProviderQuotaState {
  limit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
}

export interface KeyQuotaState extends ProviderQuotaState {
  index: number;
  /** True when this key uses an explicit keyQuotas entry rather than inheriting provider.quotaLimitTokens. */
  explicit: boolean;
}

/** Indexes aligned with configuredProviderKeys (deduped non-empty credentials). */
function configuredKeyIndexes(provider: ProviderConfig): number[] {
  const candidates = [provider.apiKey, ...(Array.isArray(provider.apiKeys) ? provider.apiKeys : [])];
  if (!candidates.some((value) => typeof value === "string" && value.trim()) && provider.oauthAccessToken) {
    candidates.push(provider.oauthAccessToken);
  }
  const seen = new Set<string>();
  const indexes: number[] = [];
  candidates.forEach((value, index) => {
    const key = typeof value === "string" ? value.trim() : "";
    if (!key || seen.has(key)) return;
    seen.add(key);
    indexes.push(index);
  });
  return indexes;
}

/** Own key limit if set (>0); otherwise inherit provider.quotaLimitTokens; otherwise unlimited (null). */
export function effectiveKeyQuotaLimit(provider: ProviderConfig, keyIndex: number): number | null {
  const own = Number(provider.keyQuotas?.[keyIndex]?.quotaLimitTokens ?? 0);
  if (own > 0) return own;
  const inherited = Number(provider.quotaLimitTokens ?? 0);
  if (inherited > 0) return inherited;
  return null;
}

export function getProviderQuotaUsedToday(provider: ProviderConfig, store: UsageQuotaStore): number {
  const today = todayKey();
  return store.usage
    .filter(
      (item) =>
        usageDayKey(item.createdAt) === today &&
        item.providerId === provider.id &&
        item.status === "success"
    )
    .reduce((sum, item) => sum + item.inputTokens + item.outputTokens, 0);
}

/** Tokens used today for one key index. Legacy rows without keyIndex count toward index 0. */
export function getKeyQuotaUsedToday(provider: ProviderConfig, store: UsageQuotaStore, keyIndex: number): number {
  const today = todayKey();
  return store.usage
    .filter((item) => {
      if (usageDayKey(item.createdAt) !== today || item.providerId !== provider.id || item.status !== "success") {
        return false;
      }
      if (typeof item.keyIndex === "number") return item.keyIndex === keyIndex;
      return keyIndex === 0;
    })
    .reduce((sum, item) => sum + item.inputTokens + item.outputTokens, 0);
}

/** Provider-level bar: uses shared provider.quotaLimitTokens vs all successful usage. */
export function getProviderQuotaState(provider: ProviderConfig, store: UsageQuotaStore): ProviderQuotaState | null {
  const limit = Number(provider.quotaLimitTokens ?? 0);
  if (!limit || limit <= 0) return null;
  const used = getProviderQuotaUsedToday(provider, store);
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining, exhausted: remaining <= 0 };
}

export function getKeyQuotaState(
  provider: ProviderConfig,
  store: UsageQuotaStore,
  keyIndex: number
): KeyQuotaState | null {
  const limit = effectiveKeyQuotaLimit(provider, keyIndex);
  if (limit == null) return null;
  const used = getKeyQuotaUsedToday(provider, store, keyIndex);
  const remaining = Math.max(0, limit - used);
  const explicit = Number(provider.keyQuotas?.[keyIndex]?.quotaLimitTokens ?? 0) > 0;
  return { index: keyIndex, limit, used, remaining, exhausted: remaining <= 0, explicit };
}

export function listKeyQuotaStates(provider: ProviderConfig, store: UsageQuotaStore): KeyQuotaState[] {
  return configuredKeyIndexes(provider)
    .map((index) => getKeyQuotaState(provider, store, index))
    .filter((state): state is KeyQuotaState => Boolean(state));
}

/**
 * Routing gate: skip the provider only when every credential with a finite
 * effective quota is exhausted. Keys without a limit stay available.
 */
export function isProviderRoutingQuotaExhausted(provider: ProviderConfig, store: NesaStore): boolean {
  const indexes = configuredKeyIndexes(provider);
  if (!indexes.length) {
    return Boolean(getProviderQuotaState(provider, store)?.exhausted);
  }
  const states = indexes.map((index) => getKeyQuotaState(provider, store, index));
  const limited = states.filter((state): state is KeyQuotaState => Boolean(state));
  if (!limited.length) return false;
  return limited.every((state) => state.exhausted);
}

export function providerQuotaReason(state: ProviderQuotaState): string {
  return `Daily token quota exhausted (${state.used}/${state.limit}).`;
}

export function providerRoutingQuotaReason(provider: ProviderConfig, store: NesaStore): string {
  const states = listKeyQuotaStates(provider, store);
  if (states.length) {
    return `All API key daily quotas exhausted (${states.map((s) => `#${s.index + 1} ${s.used}/${s.limit}`).join(", ")}).`;
  }
  const providerState = getProviderQuotaState(provider, store);
  return providerState ? providerQuotaReason(providerState) : "Daily token quota exhausted.";
}

/** Keep keyQuotas aligned when adding/removing keys. */
export function alignKeyQuotas(
  keyQuotas: ProviderConfig["keyQuotas"] | undefined,
  keyCount: number
): NonNullable<ProviderConfig["keyQuotas"]> {
  const next = Array.isArray(keyQuotas) ? keyQuotas.map((item) => ({ ...item })) : [];
  while (next.length < keyCount) next.push({});
  if (next.length > keyCount) next.length = keyCount;
  return next;
}

export function spliceKeyQuotas(
  keyQuotas: ProviderConfig["keyQuotas"] | undefined,
  index: number
): ProviderConfig["keyQuotas"] {
  if (!Array.isArray(keyQuotas) || !keyQuotas.length) return keyQuotas;
  const next = [...keyQuotas];
  if (index >= 0 && index < next.length) next.splice(index, 1);
  return next.length ? next : undefined;
}
