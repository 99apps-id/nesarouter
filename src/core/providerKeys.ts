import { ProviderConfig } from "@/core/types";
import { isKeylessProvider } from "@/core/providerCredentials";

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
  return candidates.flatMap((value, index) => {
    const key = typeof value === "string" ? value.trim() : "";
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ key, index }];
  });
}

/**
 * Return the active (non-cooled) keys for a provider in round-robin order.
 * The primary key and every extra key are included in one shared pool.
 */
export function pickActiveKeys(provider: ProviderConfig): PickedKey[] {
  const now = Date.now();
  const active: PickedKey[] = [];
  for (const entry of configuredProviderKeys(provider)) {
    const cd = cooldowns.get(cooldownKey(provider.id, entry.index));
    if (cd && cd.until > now) continue;
    active.push(entry);
  }
  if (active.length <= 1) {
    if (active.length === 0 && isKeylessProvider(provider)) {
      return [{ key: "", index: 0 }];
    }
    return active;
  }

  const lastIndex = lastUsedIndex.get(provider.id) ?? -1;
  const start = active.findIndex((entry) => entry.index > lastIndex);
  const pivot = start >= 0 ? start : 0;
  const rotated = [...active.slice(pivot), ...active.slice(0, pivot)];
  return rotated;
}

export function rememberKeyUse(providerId: string, index: number) {
  lastUsedIndex.set(providerId, index);
}
