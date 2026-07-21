import { NesaStore, ProviderConfig } from "@/core/types";
import { isKeylessProvider } from "@/core/providerCredentials";
import { getKeyQuotaState } from "@/core/quota";

interface KeyCooldown {
  until: number;
}

const cooldowns = new Map<string, KeyCooldown>();
const lastUsedIndex = new Map<string, number>();

function cooldownKey(providerId: string, index: number) {
  return `${providerId}:${index}`;
}

export function markKeyCooldown(providerId: string, index: number, cooldownMs: number) {
  if (cooldownMs <= 0) return;
  cooldowns.set(cooldownKey(providerId, index), { until: Date.now() + cooldownMs });
}

export function clearKeyCooldown(providerId: string, index: number) {
  cooldowns.delete(cooldownKey(providerId, index));
}

export function clearProviderKeys(providerId: string) {
  for (const key of cooldowns.keys()) {
    if (key.startsWith(`${providerId}:`)) cooldowns.delete(key);
  }
}

export interface PickedKey {
  key: string;
  index: number;
}

/** All configured credentials in stable display/rotation order. */
export function configuredProviderKeys(provider: ProviderConfig): PickedKey[] {
  const candidates = [provider.apiKey, ...(Array.isArray(provider.apiKeys) ? provider.apiKeys : [])];
  if (!candidates.some((value) => typeof value === "string" && value.trim()) && provider.oauthAccessToken) {
    candidates.push(provider.oauthAccessToken);
  }
  const seen = new Set<string>();
  const configured: PickedKey[] = [];
  for (const value of candidates) {
    const key = typeof value === "string" ? value.trim() : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // Runtime indexes must match the deduplicated key list shown in the UI and
    // used by keyQuotas. Raw array positions can contain blanks/duplicates.
    configured.push({ key, index: configured.length });
  }
  return configured;
}

/**
 * Return the active (non-cooled, non-quota-exhausted) keys for a provider.
 * When `store` is provided:
 * - keys past their effective daily quota are skipped
 * - keys with an explicit per-key quota are tried first ("utamakan")
 * - then highest remaining, then round-robin
 */
export function pickActiveKeys(provider: ProviderConfig, store?: NesaStore): PickedKey[] {
  const now = Date.now();
  const active: PickedKey[] = [];
  for (const entry of configuredProviderKeys(provider)) {
    const cd = cooldowns.get(cooldownKey(provider.id, entry.index));
    if (cd && cd.until > now) continue;
    if (store) {
      const quota = getKeyQuotaState(provider, store, entry.index);
      if (quota?.exhausted) continue;
    }
    active.push(entry);
  }
  if (active.length <= 1) {
    if (active.length === 0 && isKeylessProvider(provider)) {
      return [{ key: "", index: 0 }];
    }
    return active;
  }

  if (store) {
    active.sort((a, b) => {
      const qa = getKeyQuotaState(provider, store, a.index);
      const qb = getKeyQuotaState(provider, store, b.index);
      const explicitA = qa?.explicit ? 1 : 0;
      const explicitB = qb?.explicit ? 1 : 0;
      if (explicitA !== explicitB) return explicitB - explicitA;
      const remA = qa?.remaining ?? Number.POSITIVE_INFINITY;
      const remB = qb?.remaining ?? Number.POSITIVE_INFINITY;
      if (remA !== remB) return remB - remA;
      return a.index - b.index;
    });
    // Still rotate among equal-priority keys starting after last used.
    const lastIndex = lastUsedIndex.get(provider.id) ?? -1;
    const samePriority = (entry: PickedKey) => {
      const q = getKeyQuotaState(provider, store, entry.index);
      const top = getKeyQuotaState(provider, store, active[0].index);
      return Boolean(q?.explicit) === Boolean(top?.explicit) && (q?.remaining ?? Infinity) === (top?.remaining ?? Infinity);
    };
    const group = active.filter(samePriority);
    if (group.length > 1) {
      const start = group.findIndex((entry) => entry.index > lastIndex);
      const pivot = start >= 0 ? start : 0;
      const rotatedGroup = [...group.slice(pivot), ...group.slice(0, pivot)];
      const rest = active.filter((entry) => !samePriority(entry));
      return [...rotatedGroup, ...rest];
    }
    return active;
  }

  const lastIndex = lastUsedIndex.get(provider.id) ?? -1;
  const start = active.findIndex((entry) => entry.index > lastIndex);
  const pivot = start >= 0 ? start : 0;
  return [...active.slice(pivot), ...active.slice(0, pivot)];
}

export function rememberKeyUse(providerId: string, index: number) {
  lastUsedIndex.set(providerId, index);
}
