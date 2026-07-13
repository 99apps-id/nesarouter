import { getPreset, OAuthPreset } from "@/core/oauthProviderPresets";
import { refreshKiroToken, refreshToken } from "@/core/oauthPkce";
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
export async function ensureFreshAccessToken(provider: ProviderConfig): Promise<string | null> {
  if (!provider.oauthProfile) return provider.oauthAccessToken ?? null;
  const preset = getPreset(provider.oauthProfile);
  if (!preset) return provider.oauthAccessToken ?? null;
  if (!provider.oauthAccessToken) return null;

  if (preset.profile === "github_copilot") {
    // Refresh the GitHub access token if it is about to expire.
    if (tokenNeedsRefresh(provider, preset) && provider.oauthRefreshToken) {
      try {
        const tokens = await refreshToken(preset, provider.oauthRefreshToken);
        const accessToken = tokens.access_token;
        if (!accessToken) return provider.oauthCopilotToken ?? null;
        const refreshTokenValue = tokens.refresh_token ?? provider.oauthRefreshToken;
        const expiresAt = computeExpiry(tokens.expires_in);
        await saveProviderOAuthTokens(provider.id, { accessToken, refreshToken: refreshTokenValue, expiresAt });
        provider = { ...provider, oauthAccessToken: accessToken };
      } catch {
        // fall through with the existing access token
      }
    }
    if (!copilotTokenNeedsRefresh(provider, preset)) return provider.oauthCopilotToken ?? null;
    const githubAccessToken = provider.oauthAccessToken;
    if (!githubAccessToken) return provider.oauthCopilotToken ?? null;
    const refreshed = await refreshCopilotToken(preset, githubAccessToken);
    if (!refreshed) return provider.oauthCopilotToken ?? null;
    await saveProviderOAuthTokens(provider.id, {
      accessToken: githubAccessToken,
      refreshToken: provider.oauthRefreshToken,
      expiresAt: provider.oauthTokenExpiresAt,
      copilotToken: refreshed.token,
      copilotTokenExpiresAt: refreshed.expiresAt
    });
    return refreshed.token;
  }

  if (!tokenNeedsRefresh(provider, preset)) return provider.oauthAccessToken;
  if (!provider.oauthRefreshToken) return provider.oauthAccessToken;

  try {
    const tokens = preset.kiroDeviceFlow && provider.oauthDeviceClientId && provider.oauthDeviceClientSecret
      ? await refreshKiroToken(
          preset.kiroRegion ?? "us-east-1",
          provider.oauthDeviceClientId,
          provider.oauthDeviceClientSecret,
          provider.oauthRefreshToken
        )
      : await refreshToken(preset, provider.oauthRefreshToken);
    const accessToken = tokens.access_token;
    if (!accessToken) return provider.oauthAccessToken;
    const refreshTokenValue = tokens.refresh_token ?? provider.oauthRefreshToken;
    const expiresAt = computeExpiry(tokens.expires_in);
    await saveProviderOAuthTokens(provider.id, {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresAt,
      deviceClientId: provider.oauthDeviceClientId,
      deviceClientSecret: provider.oauthDeviceClientSecret
    });
    return accessToken;
  } catch {
    return provider.oauthAccessToken;
  }
}

export async function loadProviderWithFreshToken(providerId: string): Promise<ProviderConfig | null> {
  const provider = await readProviderById(providerId);
  if (!provider) return null;
  await ensureFreshAccessToken(provider);
  const refreshed = await readProviderById(providerId);
  return refreshed ?? null;
}
