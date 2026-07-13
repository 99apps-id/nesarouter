import { getPreset, OAuthPreset } from "@/core/oauthProviderPresets";
import { refreshKiroToken, refreshToken } from "@/core/oauthPkce";
import { configuredOAuthAccounts, providerForOAuthAccount } from "@/core/oauthAccounts";
import { ProviderConfig } from "@/core/types";
import { readProviderById, saveProviderOAuthTokens } from "@/lib/store";

function tokenNeedsRefresh(provider: ProviderConfig, preset: OAuthPreset): boolean {
  if (!provider.oauthAccessToken) return false;
  if (!provider.oauthTokenExpiresAt) return true;
  const expiresAt = new Date(provider.oauthTokenExpiresAt).getTime();
  return Date.now() + preset.refreshLeadMs >= expiresAt;
}

function computeExpiry(expiresIn?: number): string | undefined {
  if (!expiresIn) return undefined;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function refreshCopilotToken(preset: OAuthPreset, githubAccessToken: string): Promise<{ token: string; expiresAt: string } | null> {
  if (!preset.copilotTokenUrl) return null;
  const response = await fetch(preset.copilotTokenUrl, {
    headers: {
      authorization: `token ${githubAccessToken}`,
      accept: "application/json",
      ...(preset.copilotHeaders ?? {})
    }
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (!data?.token) return null;
  // GitHub returns expires_at as a unix timestamp (seconds).
  const expiresAtRaw = data.expires_at;
  const expiresAt = typeof expiresAtRaw === "number"
    ? new Date(expiresAtRaw * 1000).toISOString()
    : expiresAtRaw ?? new Date(Date.now() + 25 * 60_000).toISOString();
  return { token: data.token, expiresAt };
}

function copilotTokenNeedsRefresh(provider: ProviderConfig, preset: OAuthPreset): boolean {
  if (!provider.oauthCopilotToken) return true;
  if (!provider.oauthCopilotTokenExpiresAt) return true;
  const expiresAt = new Date(provider.oauthCopilotTokenExpiresAt).getTime();
  return Date.now() + preset.refreshLeadMs >= expiresAt;
}

/**
 * Ensure the provider has a usable bearer token. For standard OAuth profiles
 * this returns the (refreshed) access token. For GitHub Copilot it returns the
 * short-lived Copilot session token (refreshing the GitHub access token first
 * if needed, then exchanging it for a new Copilot token). Returns null when the
 * provider has no OAuth material at all.
 */
export async function ensureFreshAccessToken(provider: ProviderConfig, accountId?: string): Promise<string | null> {
  if (!provider.oauthProfile) return provider.oauthAccessToken ?? null;
  const account = accountId
    ? configuredOAuthAccounts(provider).find((item) => item.id === accountId)
    : configuredOAuthAccounts(provider)[0];
  if (!account) return null;
  const snapshot = providerForOAuthAccount(provider, account);
  const preset = getPreset(snapshot.oauthProfile);
  if (!preset) return snapshot.oauthAccessToken ?? null;
  if (!snapshot.oauthAccessToken) return null;

  if (preset.profile === "github_copilot") {
    if (tokenNeedsRefresh(snapshot, preset) && snapshot.oauthRefreshToken) {
      try {
        const tokens = await refreshToken(preset, snapshot.oauthRefreshToken);
        const accessToken = tokens.access_token;
        if (!accessToken) return snapshot.oauthCopilotToken ?? null;
        const refreshTokenValue = tokens.refresh_token ?? snapshot.oauthRefreshToken;
        const expiresAt = computeExpiry(tokens.expires_in);
        await saveProviderOAuthTokens(snapshot.id, { accessToken, refreshToken: refreshTokenValue, expiresAt }, { accountId: account.id });
        snapshot.oauthAccessToken = accessToken;
      } catch {
        // fall through with the existing access token
      }
    }
    if (!copilotTokenNeedsRefresh(snapshot, preset)) return snapshot.oauthCopilotToken ?? null;
    const githubAccessToken = snapshot.oauthAccessToken;
    if (!githubAccessToken) return snapshot.oauthCopilotToken ?? null;
    const refreshed = await refreshCopilotToken(preset, githubAccessToken);
    if (!refreshed) return snapshot.oauthCopilotToken ?? null;
    await saveProviderOAuthTokens(snapshot.id, {
      accessToken: githubAccessToken,
      refreshToken: snapshot.oauthRefreshToken,
      expiresAt: snapshot.oauthTokenExpiresAt,
      copilotToken: refreshed.token,
      copilotTokenExpiresAt: refreshed.expiresAt
    }, { accountId: account.id });
    return refreshed.token;
  }

  if (!tokenNeedsRefresh(snapshot, preset)) return snapshot.oauthAccessToken;
  if (!snapshot.oauthRefreshToken) return snapshot.oauthAccessToken;

  try {
    const tokens = preset.kiroDeviceFlow && snapshot.oauthDeviceClientId && snapshot.oauthDeviceClientSecret
      ? await refreshKiroToken(
          preset.kiroRegion ?? "us-east-1",
          snapshot.oauthDeviceClientId,
          snapshot.oauthDeviceClientSecret,
          snapshot.oauthRefreshToken
        )
      : await refreshToken(preset, snapshot.oauthRefreshToken);
    const accessToken = tokens.access_token;
    if (!accessToken) return snapshot.oauthAccessToken;
    const refreshTokenValue = tokens.refresh_token ?? snapshot.oauthRefreshToken;
    const expiresAt = computeExpiry(tokens.expires_in);
    await saveProviderOAuthTokens(snapshot.id, {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresAt,
      deviceClientId: snapshot.oauthDeviceClientId,
      deviceClientSecret: snapshot.oauthDeviceClientSecret
    }, { accountId: account.id });
    return accessToken;
  } catch {
    return snapshot.oauthAccessToken;
  }
}

export async function loadProviderWithFreshToken(providerId: string): Promise<ProviderConfig | null> {
  const provider = await readProviderById(providerId);
  if (!provider) return null;
  await ensureFreshAccessToken(provider);
  const refreshed = await readProviderById(providerId);
  return refreshed ?? null;
}
