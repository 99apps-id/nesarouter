import { OAuthAccount, ProviderConfig, ProviderConnectionStatus } from "@/core/types";
import { createOAuthAccountId, defaultOAuthAccountName } from "@/core/oauthAccounts";
import { serializeOAuthAccounts } from "@/lib/oauthAccountCodec";
import { syncPrimaryOAuthColumns, syncProviderOAuthConnectionStatus } from "@/lib/oauthAccountColumns";
import { getDb, readProviderById } from "@/lib/store";

export interface ProviderOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  copilotToken?: string;
  copilotTokenExpiresAt?: string;
  projectId?: string;
  deviceClientId?: string;
  deviceClientSecret?: string;
  machineId?: string;
  profileArn?: string;
}

export interface SaveProviderOAuthOptions {
  accountId?: string;
  createNew?: boolean;
  accountName?: string;
}

function configuredOAuthAccountsFromProvider(provider: ProviderConfig): OAuthAccount[] {
  if (Array.isArray(provider.oauthAccounts) && provider.oauthAccounts.length) return [...provider.oauthAccounts];
  if (!provider.oauthAccessToken && !provider.oauthCopilotToken) return [];
  return [{
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
  }];
}

function writeAccounts(providerId: string, accounts: OAuthAccount[], syncConnection = true) {
  const database = getDb();
  database
    .prepare("UPDATE providers SET oauth_accounts = ? WHERE id = ?")
    .run(serializeOAuthAccounts(accounts), providerId);
  syncPrimaryOAuthColumns(database, providerId, accounts);
  if (syncConnection) syncProviderOAuthConnectionStatus(database, providerId, accounts);
}

export async function saveProviderOAuthTokens(
  providerId: string,
  tokens: ProviderOAuthTokens,
  options?: SaveProviderOAuthOptions
) {
  const provider = await readProviderById(providerId);
  if (!provider) throw new Error("Provider not found.");
  const existingAccounts = configuredOAuthAccountsFromProvider(provider);
  const accountId = options?.createNew
    ? createOAuthAccountId()
    : options?.accountId ?? existingAccounts[0]?.id ?? "legacy";
  const existing = existingAccounts.find((account) => account.id === accountId);
  if (options?.accountId && !options.createNew && !existing) {
    throw new Error("OAuth account no longer exists. Refresh the page and start Connect again.");
  }

  const now = new Date().toISOString();
  const nextAccount: OAuthAccount = {
    id: accountId,
    name:
      options?.accountName ??
      existing?.name ??
      defaultOAuthAccountName(
        options?.createNew ? existingAccounts.length : Math.max(existingAccounts.length - 1, 0)
      ),
    oauthAccessToken: tokens.accessToken,
    oauthRefreshToken: tokens.refreshToken ?? existing?.oauthRefreshToken,
    oauthTokenExpiresAt: tokens.expiresAt ?? existing?.oauthTokenExpiresAt,
    oauthLastRefreshAt: now,
    oauthCopilotToken: tokens.copilotToken ?? existing?.oauthCopilotToken,
    oauthCopilotTokenExpiresAt: tokens.copilotTokenExpiresAt ?? existing?.oauthCopilotTokenExpiresAt,
    oauthProjectId: tokens.projectId ?? existing?.oauthProjectId,
    oauthDeviceClientId: tokens.deviceClientId ?? existing?.oauthDeviceClientId,
    oauthDeviceClientSecret: tokens.deviceClientSecret ?? existing?.oauthDeviceClientSecret,
    oauthMachineId: tokens.machineId ?? existing?.oauthMachineId,
    oauthProfileArn: tokens.profileArn ?? existing?.oauthProfileArn,
    connectionStatus: "connected",
    lastError: undefined,
    lastCheckedAt: now,
    createdAt: existing?.createdAt ?? now
  };
  const accounts =
    options?.createNew || !existing
      ? [...existingAccounts, nextAccount]
      : existingAccounts.map((account) => (account.id === accountId ? { ...account, ...nextAccount } : account));

  writeAccounts(providerId, accounts);
  if (provider.status === "disabled" || provider.status === "cooldown") {
    getDb()
      .prepare("UPDATE providers SET status = 'active', rate_limited_until = NULL WHERE id = ?")
      .run(providerId);
  }
  return accountId;
}

export async function updateProviderOAuthAccountTokens(
  providerId: string,
  accountId: string,
  patch: Partial<OAuthAccount>
) {
  const provider = await readProviderById(providerId);
  if (!provider) throw new Error("Provider not found.");
  const accounts = configuredOAuthAccountsFromProvider(provider).map((account) =>
    account.id === accountId ? { ...account, ...patch } : account
  );
  writeAccounts(providerId, accounts, false);
}

export async function clearProviderOAuthTokens(providerId: string) {
  getDb()
    .prepare(
      "UPDATE providers SET oauth_accounts = NULL, oauth_access_token_encrypted = NULL, oauth_refresh_token_encrypted = NULL, oauth_token_expires_at = NULL, oauth_last_refresh_at = NULL, oauth_copilot_token_encrypted = NULL, oauth_copilot_token_expires_at = NULL, oauth_project_id = NULL, oauth_device_client_id = NULL, oauth_device_client_secret_encrypted = NULL, oauth_machine_id = NULL, oauth_profile_arn = NULL WHERE id = ?"
    )
    .run(providerId);
}

export async function clearOAuthAccount(providerId: string, accountId: string) {
  const provider = await readProviderById(providerId);
  if (!provider) return;
  const accounts = configuredOAuthAccountsFromProvider(provider).filter((account) => account.id !== accountId);
  if (!accounts.length) {
    await clearProviderOAuthTokens(providerId);
    return;
  }
  writeAccounts(providerId, accounts);
}

export async function markOAuthAccountConnection(
  providerId: string,
  accountId: string,
  ok: boolean,
  message?: string,
  options?: { rateLimitedUntil?: string; status?: ProviderConnectionStatus }
) {
  const provider = await readProviderById(providerId);
  if (!provider) return;
  const status: ProviderConnectionStatus = options?.status ?? (ok ? "connected" : "error");
  const accounts = configuredOAuthAccountsFromProvider(provider).map((account) =>
    account.id === accountId
      ? {
          ...account,
          connectionStatus: status,
          lastError: status === "connected" ? undefined : message?.slice(0, 500),
          lastCheckedAt: new Date().toISOString(),
          rateLimitedUntil:
            options?.rateLimitedUntil ?? (status === "connected" ? undefined : account.rateLimitedUntil)
        }
      : account
  );
  writeAccounts(providerId, accounts);
}

export async function writeOAuthAccounts(providerId: string, accounts: OAuthAccount[]) {
  writeAccounts(providerId, accounts);
}
