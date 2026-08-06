import { OAuthAccount, ProviderConfig } from "@/core/types";
import { decryptSecret, encryptSecret, isRedactedSecret } from "@/lib/crypto";

type StoredOAuthAccount = {
  id: string;
  name?: string;
  oauthAccessTokenEncrypted?: string;
  oauthRefreshTokenEncrypted?: string;
  oauthTokenExpiresAt?: string;
  oauthLastRefreshAt?: string;
  oauthCopilotTokenEncrypted?: string;
  oauthCopilotTokenExpiresAt?: string;
  oauthProjectId?: string;
  oauthDeviceClientId?: string;
  oauthDeviceClientSecretEncrypted?: string;
  oauthMachineId?: string;
  oauthProfileArn?: string;
  connectionStatus?: ProviderConfig["connectionStatus"];
  lastError?: string;
  lastCheckedAt?: string;
  rateLimitedUntil?: string;
  createdAt?: string;
};

export interface LegacyOAuthColumns {
  oauth_access_token_encrypted?: string;
  oauth_refresh_token_encrypted?: string;
  oauth_copilot_token_encrypted?: string;
  oauth_copilot_token_expires_at?: string;
  oauth_token_expires_at?: string;
  oauth_last_refresh_at?: string;
  oauth_project_id?: string;
  oauth_device_client_id?: string;
  oauth_device_client_secret_encrypted?: string;
  oauth_machine_id?: string;
  oauth_profile_arn?: string;
  connection_status?: string;
  last_error?: string;
  rate_limited_until?: string;
}

function oauthAccountFromStored(stored: StoredOAuthAccount): OAuthAccount {
  return {
    id: stored.id,
    name: stored.name,
    oauthAccessToken: stored.oauthAccessTokenEncrypted ? decryptSecret(stored.oauthAccessTokenEncrypted) : undefined,
    oauthRefreshToken: stored.oauthRefreshTokenEncrypted ? decryptSecret(stored.oauthRefreshTokenEncrypted) : undefined,
    oauthTokenExpiresAt: stored.oauthTokenExpiresAt,
    oauthLastRefreshAt: stored.oauthLastRefreshAt,
    oauthCopilotToken: stored.oauthCopilotTokenEncrypted ? decryptSecret(stored.oauthCopilotTokenEncrypted) : undefined,
    oauthCopilotTokenExpiresAt: stored.oauthCopilotTokenExpiresAt,
    oauthProjectId: stored.oauthProjectId,
    oauthDeviceClientId: stored.oauthDeviceClientId,
    oauthDeviceClientSecret: stored.oauthDeviceClientSecretEncrypted
      ? decryptSecret(stored.oauthDeviceClientSecretEncrypted)
      : undefined,
    oauthMachineId: stored.oauthMachineId,
    oauthProfileArn: stored.oauthProfileArn,
    connectionStatus: stored.connectionStatus,
    lastError: stored.lastError,
    lastCheckedAt: stored.lastCheckedAt,
    rateLimitedUntil: stored.rateLimitedUntil,
    createdAt: stored.createdAt
  };
}

function oauthAccountToStored(account: OAuthAccount): StoredOAuthAccount {
  const encrypted = (value?: string) =>
    value && !isRedactedSecret(value) ? encryptSecret(value.trim()) : undefined;
  return {
    id: account.id,
    name: account.name,
    oauthAccessTokenEncrypted: encrypted(account.oauthAccessToken),
    oauthRefreshTokenEncrypted: encrypted(account.oauthRefreshToken),
    oauthTokenExpiresAt: account.oauthTokenExpiresAt,
    oauthLastRefreshAt: account.oauthLastRefreshAt,
    oauthCopilotTokenEncrypted: encrypted(account.oauthCopilotToken),
    oauthCopilotTokenExpiresAt: account.oauthCopilotTokenExpiresAt,
    oauthProjectId: account.oauthProjectId,
    oauthDeviceClientId: account.oauthDeviceClientId,
    oauthDeviceClientSecretEncrypted: encrypted(account.oauthDeviceClientSecret),
    oauthMachineId: account.oauthMachineId,
    oauthProfileArn: account.oauthProfileArn,
    connectionStatus: account.connectionStatus,
    lastError: account.lastError,
    lastCheckedAt: account.lastCheckedAt,
    rateLimitedUntil: account.rateLimitedUntil,
    createdAt: account.createdAt
  };
}

export function parseOAuthAccounts(raw: unknown): OAuthAccount[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(String(raw)) as StoredOAuthAccount[];
    if (!Array.isArray(parsed) || !parsed.length) return undefined;
    return parsed.map(oauthAccountFromStored).filter((account) => Boolean(account.id));
  } catch {
    return undefined;
  }
}

export function serializeOAuthAccounts(accounts: OAuthAccount[]) {
  return JSON.stringify(accounts.map(oauthAccountToStored));
}

/** Keep real secrets when the admin UI posts redacted placeholders. */
export function preserveOAuthAccountSecrets(incoming: OAuthAccount, existing?: OAuthAccount): OAuthAccount {
  const pick = (next?: string, previous?: string) => {
    if (next !== undefined && next !== "" && !isRedactedSecret(next)) return next;
    return previous;
  };
  return {
    ...existing,
    ...incoming,
    oauthAccessToken: pick(incoming.oauthAccessToken, existing?.oauthAccessToken),
    oauthRefreshToken: pick(incoming.oauthRefreshToken, existing?.oauthRefreshToken),
    oauthCopilotToken: pick(incoming.oauthCopilotToken, existing?.oauthCopilotToken),
    oauthDeviceClientSecret: pick(incoming.oauthDeviceClientSecret, existing?.oauthDeviceClientSecret),
    oauthMachineId:
      incoming.oauthMachineId !== undefined && !isRedactedSecret(incoming.oauthMachineId)
        ? incoming.oauthMachineId
        : existing?.oauthMachineId ?? incoming.oauthMachineId
  };
}

export function legacyOAuthAccountFromRow(row: LegacyOAuthColumns): OAuthAccount | null {
  if (!row.oauth_access_token_encrypted && !row.oauth_copilot_token_encrypted) return null;
  return {
    id: "legacy",
    name: "Account 1",
    oauthAccessToken: row.oauth_access_token_encrypted ? decryptSecret(row.oauth_access_token_encrypted) : undefined,
    oauthRefreshToken: row.oauth_refresh_token_encrypted ? decryptSecret(row.oauth_refresh_token_encrypted) : undefined,
    oauthTokenExpiresAt: row.oauth_token_expires_at ?? undefined,
    oauthLastRefreshAt: row.oauth_last_refresh_at ?? undefined,
    oauthCopilotToken: row.oauth_copilot_token_encrypted ? decryptSecret(row.oauth_copilot_token_encrypted) : undefined,
    oauthCopilotTokenExpiresAt: row.oauth_copilot_token_expires_at ?? undefined,
    oauthProjectId: row.oauth_project_id ?? undefined,
    oauthDeviceClientId: row.oauth_device_client_id ?? undefined,
    oauthDeviceClientSecret: row.oauth_device_client_secret_encrypted
      ? decryptSecret(row.oauth_device_client_secret_encrypted)
      : undefined,
    oauthMachineId: row.oauth_machine_id ?? undefined,
    oauthProfileArn: row.oauth_profile_arn ?? undefined,
    connectionStatus: row.connection_status as OAuthAccount["connectionStatus"],
    lastError: row.last_error ?? undefined,
    rateLimitedUntil: row.rate_limited_until ?? undefined
  };
}

export function mergeIncomingOAuthAccounts(
  incoming: OAuthAccount[] | undefined,
  existingRaw: string | null | undefined,
  legacyRow?: LegacyOAuthColumns
): OAuthAccount[] | undefined {
  const existing =
    parseOAuthAccounts(existingRaw) ??
    (legacyRow ? ([legacyOAuthAccountFromRow(legacyRow)].filter(Boolean) as OAuthAccount[]) : []);
  if (incoming === undefined || !incoming.length) return existing.length ? existing : undefined;
  const byId = new Map(existing.map((account) => [account.id, account]));
  return incoming.map((account, index) =>
    preserveOAuthAccountSecrets(account, byId.get(account.id) ?? existing[index])
  );
}
