import { ensureFreshAccessToken } from "@/core/providerOAuthFlow";
import { configuredOAuthAccounts, providerWithFreshOAuthToken } from "@/core/oauthAccounts";
import { isOAuthAccountFatalError, isOAuthAccountRoutable, oauthAccountStatusLabel } from "@/core/oauthAccountHealth";
import { testProviderConnection, UpstreamProviderError } from "@/core/providerClient";
import { ProviderConfig } from "@/core/types";
import { clearProviderCooldown, markOAuthAccountConnection } from "@/lib/store";

export interface OAuthAccountStatusResult {
  id: string;
  name: string;
  status: "connected" | "error" | "no_subscription" | "empty" | "unknown";
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

  const snapshot = providerWithFreshOAuthToken(provider, account, fresh);
  try {
    const result = await testProviderConnection(snapshot);
    if (result?.connectionStatus === "no_subscription") {
      const message =
        result.message ??
        "Google login OK — no active Cloud Code / Gemini subscription on this account.";
      await markOAuthAccountConnection(provider.id, account.id, false, message, {
        status: "no_subscription"
      });
      return {
        id: account.id,
        name: account.name ?? `Account ${account.index + 1}`,
        status: "no_subscription",
        lastError: message,
        lastCheckedAt: new Date().toISOString(),
        routable: false
      };
    }
    await markOAuthAccountConnection(provider.id, account.id, true);
    await clearProviderCooldown(provider.id);
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
    const status = oauthAccountStatusLabel(account, provider);
    return {
      id: account.id,
      name: account.name ?? `Account ${account.index + 1}`,
      status,
      lastError: account.lastError,
      lastCheckedAt: account.lastCheckedAt,
      routable: isOAuthAccountRoutable(account, Date.now(), provider)
    };
  });
}
