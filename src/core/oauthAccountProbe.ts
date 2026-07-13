import { ensureFreshAccessToken } from "@/core/providerOAuthFlow";
import { configuredOAuthAccounts, providerForOAuthAccount } from "@/core/oauthAccounts";
import { isOAuthAccountFatalError } from "@/core/oauthAccountHealth";
import { testProviderConnection, UpstreamProviderError } from "@/core/providerClient";
import { ProviderConfig } from "@/core/types";
import { markOAuthAccountConnection } from "@/lib/store";

export interface OAuthAccountStatusResult {
  id: string;
  name: string;
  status: "connected" | "error" | "empty" | "unknown";
  lastError?: string;
  lastCheckedAt?: string;
  routable: boolean;
}

export async function probeOAuthAccount(
  provider: ProviderConfig,
  accountId: string
): Promise<OAuthAccountStatusResult> {
  const account = configuredOAuthAccounts(provider).find((item) => item.id === accountId);
  if (!account) {
    return { id: accountId, name: accountId, status: "empty", routable: false };
  }
  if (!account.oauthAccessToken && !account.oauthCopilotToken) {
    return {
      id: account.id,
      name: account.name ?? `Account ${account.index + 1}`,
      status: "empty",
      routable: false
    };
  }

  const fresh = await ensureFreshAccessToken(provider, account.id);
  if (!fresh) {
    const message = "OAuth token unavailable or refresh failed.";
    await markOAuthAccountConnection(provider.id, account.id, false, message);
    return {
      id: account.id,
      name: account.name ?? `Account ${account.index + 1}`,
      status: "error",
      lastError: message,
      lastCheckedAt: new Date().toISOString(),
      routable: false
    };
  }

  const snapshot = { ...providerForOAuthAccount(provider, account), oauthAccessToken: fresh };
  try {
    await testProviderConnection(snapshot);
    await markOAuthAccountConnection(provider.id, account.id, true);
    return {
      id: account.id,
      name: account.name ?? `Account ${account.index + 1}`,
      status: "connected",
      lastCheckedAt: new Date().toISOString(),
      routable: true
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth probe failed.";
    const fatal = error instanceof UpstreamProviderError && isOAuthAccountFatalError(error);
    await markOAuthAccountConnection(provider.id, account.id, false, message);
    return {
      id: account.id,
      name: account.name ?? `Account ${account.index + 1}`,
      status: fatal ? "error" : "error",
      lastError: message,
      lastCheckedAt: new Date().toISOString(),
      routable: false
    };
  }
}

export async function probeAllOAuthAccounts(provider: ProviderConfig) {
  const accounts = configuredOAuthAccounts(provider);
  const results: OAuthAccountStatusResult[] = [];
  for (const account of accounts) {
    results.push(await probeOAuthAccount(provider, account.id));
  }
  return results;
}

export function oauthAccountStatusesFromProvider(provider: ProviderConfig): OAuthAccountStatusResult[] {
  return configuredOAuthAccounts(provider).map((account) => {
    const hasToken = Boolean(account.oauthAccessToken || account.oauthCopilotToken);
    const status = !hasToken
      ? "empty"
      : account.connectionStatus === "error"
        ? "error"
        : account.connectionStatus === "connected"
          ? "connected"
          : "unknown";
    return {
      id: account.id,
      name: account.name ?? `Account ${account.index + 1}`,
      status,
      lastError: account.lastError,
      lastCheckedAt: account.lastCheckedAt,
      routable: hasToken && account.connectionStatus !== "error"
    };
  });
}
