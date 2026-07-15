import crypto from "node:crypto";
import { isOAuthAccountRoutable, oauthAccountHasToken, oauthAccountStatusLabel } from "@/core/oauthAccountHealth";
import { OAuthAccount, ProviderConfig } from "@/core/types";

export { oauthAccountStatusLabel };

const oauthCooldowns = new Map<string, { until: number }>();
const oauthLastUsedIndex = new Map<string, number>();

function cooldownKey(providerId: string, index: number) {
  return `${providerId}:oauth:${index}`;
}

export function markOAuthAccountCooldown(providerId: string, index: number, cooldownMs: number) {
  if (cooldownMs <= 0) return;
  oauthCooldowns.set(cooldownKey(providerId, index), { until: Date.now() + cooldownMs });
}

export function clearOAuthAccountCooldown(providerId: string, index: number) {
  oauthCooldowns.delete(cooldownKey(providerId, index));
}

export function rememberOAuthAccountUse(providerId: string, index: number) {
  oauthLastUsedIndex.set(providerId, index);
}

const accountHasToken = oauthAccountHasToken;

function legacyAccountFromProvider(provider: ProviderConfig): OAuthAccount | null {
  if (!provider.oauthAccessToken && !provider.oauthCopilotToken) return null;
  return {
    id: "legacy",
    name: "Account 1",
    oauthAccessToken: provider.oauthAccessToken,
    oauthRefreshToken: provider.oauthRefreshToken,
    oauthTokenExpiresAt: provider.oauthTokenExpiresAt,
    oauthLastRefreshAt: provider.oauthLastRefreshAt,
    oauthCopilotToken: provider.oauthCopilotToken,
    oauthCopilotTokenExpiresAt: provider.oauthCopilotTokenExpiresAt,
    oauthProjectId: provider.oauthProjectId,
    oauthDeviceClientId: provider.oauthDeviceClientId,
    oauthDeviceClientSecret: provider.oauthDeviceClientSecret,
    oauthMachineId: provider.oauthMachineId,
    oauthProfileArn: provider.oauthProfileArn,
    connectionStatus: provider.connectionStatus,
    lastError: provider.lastError,
    rateLimitedUntil: provider.rateLimitedUntil
  };
}

/** Normalize stored + legacy OAuth material into a stable account list. */
export function configuredOAuthAccounts(provider: ProviderConfig): Array<OAuthAccount & { index: number }> {
  const raw = Array.isArray(provider.oauthAccounts) ? provider.oauthAccounts : [];
  const source = raw.length ? raw : [legacyAccountFromProvider(provider)].filter(Boolean) as OAuthAccount[];
  const seen = new Set<string>();
  return source.flatMap((account, index) => {
    const id = account.id?.trim() || `account-${index + 1}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ ...account, id, index }];
  });
}

export function hasOAuthConnection(provider: ProviderConfig) {
  return configuredOAuthAccounts(provider).some((account) => accountHasToken(account));
}

/** At least one OAuth account has a token and is not in error state. */
export function hasRoutableOAuthConnection(provider: ProviderConfig) {
  return configuredOAuthAccounts(provider).some((account) => isOAuthAccountRoutable(account));
}

export function oauthAccountCount(provider: ProviderConfig) {
  return configuredOAuthAccounts(provider).filter((account) => accountHasToken(account)).length;
}

export function routableOAuthAccountCount(provider: ProviderConfig) {
  return configuredOAuthAccounts(provider).filter((account) => isOAuthAccountRoutable(account)).length;
}

export function pickActiveOAuthAccounts(provider: ProviderConfig): Array<OAuthAccount & { index: number }> {
  const now = Date.now();
  const active = configuredOAuthAccounts(provider).filter((account) => {
    if (!isOAuthAccountRoutable(account, now)) return false;
    const cd = oauthCooldowns.get(cooldownKey(provider.id, account.index));
    return !(cd && cd.until > now);
  });
  if (active.length <= 1) return active;

  const lastIndex = oauthLastUsedIndex.get(provider.id) ?? -1;
  const start = active.findIndex((account) => account.index > lastIndex);
  const pivot = start >= 0 ? start : 0;
  return [...active.slice(pivot), ...active.slice(0, pivot)];
}

export function providerForOAuthAccount(provider: ProviderConfig, account: OAuthAccount): ProviderConfig {
  return {
    ...provider,
    oauthAccessToken: account.oauthAccessToken,
    oauthRefreshToken: account.oauthRefreshToken,
    oauthTokenExpiresAt: account.oauthTokenExpiresAt,
    oauthLastRefreshAt: account.oauthLastRefreshAt,
    oauthCopilotToken: account.oauthCopilotToken,
    oauthCopilotTokenExpiresAt: account.oauthCopilotTokenExpiresAt,
    oauthProjectId: account.oauthProjectId,
    oauthDeviceClientId: account.oauthDeviceClientId,
    oauthDeviceClientSecret: account.oauthDeviceClientSecret,
    oauthMachineId: account.oauthMachineId,
    oauthProfileArn: account.oauthProfileArn,
    connectionStatus: account.connectionStatus,
    lastError: account.lastError,
    rateLimitedUntil: account.rateLimitedUntil
  };
}

export function createOAuthAccountId() {
  return crypto.randomUUID();
}

export function defaultOAuthAccountName(existingCount: number) {
  return `Account ${existingCount + 1}`;
}
