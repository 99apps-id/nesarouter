import { ProviderConfig, OAuthAccount } from "@/core/types";
import { redactSecret } from "@/lib/crypto";

function redactOAuthAccount(account: OAuthAccount): OAuthAccount {
  return {
    ...account,
    oauthAccessToken: account.oauthAccessToken ? "********" : undefined,
    oauthRefreshToken: account.oauthRefreshToken ? "********" : undefined,
    oauthCopilotToken: account.oauthCopilotToken ? "********" : undefined,
    oauthDeviceClientSecret: account.oauthDeviceClientSecret ? "********" : undefined,
    oauthMachineId: account.oauthMachineId ? "********" : undefined
  };
}

/** Strip live secrets before JSON/SSR so admin cookies cannot exfiltrate them via XSS or over-broad UI. */
export function redactProviderForClient(provider: ProviderConfig): ProviderConfig {
  return {
    ...provider,
    apiKey: provider.apiKey ? redactSecret(provider.apiKey) : "",
    apiKeys: provider.apiKeys?.length ? provider.apiKeys.map(() => "********") : [],
    oauthAccounts: provider.oauthAccounts?.length ? provider.oauthAccounts.map(redactOAuthAccount) : [],
    oauthAccessToken: provider.oauthAccessToken ? "********" : undefined,
    oauthRefreshToken: provider.oauthRefreshToken ? "********" : undefined,
    oauthCopilotToken: provider.oauthCopilotToken ? "********" : undefined,
    oauthDeviceClientSecret: provider.oauthDeviceClientSecret ? "********" : undefined,
    oauthMachineId: provider.oauthMachineId ? "********" : undefined
  };
}

/** Cache metadata for the dashboard — never include upstream response bodies. */
export function redactCacheEntryForClient(entry: {
  key: string;
  createdAt: string;
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  savedCostUsd: number;
  response?: unknown;
}) {
  return {
    key: entry.key,
    createdAt: entry.createdAt,
    providerId: entry.providerId,
    model: entry.model,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    savedCostUsd: entry.savedCostUsd
  };
}
