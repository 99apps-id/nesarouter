import { getPreset, type OAuthPreset } from "@/core/oauthProviderPresets";
import { refreshCodebuddyToken, refreshCursorToken, refreshKiroToken, refreshToken } from "@/core/oauthPkce";
import { configuredOAuthAccounts, providerForOAuthAccount } from "@/core/oauthAccounts";
import { cursorAccessTokenExpiresAt } from "@/core/cursorTokenImport";
import { ProviderConfig } from "@/core/types";
import { readProviderById, saveProviderOAuthTokens, markOAuthAccountConnection } from "@/lib/store";

const UNKNOWN_EXPIRY_REFRESH_INTERVAL_MS = 45 * 60_000;

export function oauthTokenIsExpired(provider: Pick<ProviderConfig, "oauthTokenExpiresAt">, now = Date.now()): boolean {
  if (!provider.oauthTokenExpiresAt) return false;
  const expiresAt = new Date(provider.oauthTokenExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export function oauthTokenNeedsRefresh(
  provider: Pick<ProviderConfig, "oauthAccessToken" | "oauthTokenExpiresAt" | "oauthLastRefreshAt">,
  preset: Pick<OAuthPreset, "refreshLeadMs">,
  now = Date.now()
): boolean {
  if (!provider.oauthAccessToken) return false;
  if (!provider.oauthTokenExpiresAt) {
    const lastRefresh = provider.oauthLastRefreshAt ? new Date(provider.oauthLastRefreshAt).getTime() : NaN;
    return Number.isFinite(lastRefresh) && now - lastRefresh >= UNKNOWN_EXPIRY_REFRESH_INTERVAL_MS;
  }
  const expiresAt = new Date(provider.oauthTokenExpiresAt).getTime();
  return !Number.isFinite(expiresAt) || now + preset.refreshLeadMs >= expiresAt;
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
const refreshFlights = new Map<string, Promise<string | null>>();

async function ensureFreshAccessTokenImpl(provider: ProviderConfig, accountId?: string): Promise<string | null> {
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
    if (oauthTokenNeedsRefresh(snapshot, preset) && snapshot.oauthRefreshToken) {
      try {
        const tokens = await refreshToken(preset, snapshot.oauthRefreshToken);
        const accessToken = tokens.access_token;
        if (!accessToken) return snapshot.oauthCopilotToken ?? null;
        const refreshTokenValue = tokens.refresh_token ?? snapshot.oauthRefreshToken;
        const expiresAt = computeExpiry(tokens.expires_in);
        await saveProviderOAuthTokens(snapshot.id, { accessToken, refreshToken: refreshTokenValue, expiresAt }, { accountId: account.id });
        snapshot.oauthAccessToken = accessToken;
      } catch (error) {
        if (oauthTokenIsExpired(snapshot)) {
          const message = error instanceof Error ? error.message : String(error);
          await markOAuthAccountConnection(snapshot.id, account.id, false, `OAuth refresh failed: ${message.slice(0, 240)}. Reconnect this account.`);
          return null;
        }
        // The current token is still within its declared lifetime; use it until expiry.
      }
    }
    if (oauthTokenIsExpired(snapshot)) return null;
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

  if (!oauthTokenNeedsRefresh(snapshot, preset)) return snapshot.oauthAccessToken;
  if (!snapshot.oauthRefreshToken) return oauthTokenIsExpired(snapshot) ? null : snapshot.oauthAccessToken;

  try {
    if (preset.kiroDeviceFlow) {
      if (!snapshot.oauthDeviceClientId || !snapshot.oauthDeviceClientSecret) {
        // Never fall through to generic OAuth refresh — AWS OIDC requires the registered device client.
        return snapshot.oauthAccessToken;
      }
    }
    const tokens = preset.kiroDeviceFlow
      ? await refreshKiroToken(
          preset.kiroRegion ?? "us-east-1",
          snapshot.oauthDeviceClientId!,
          snapshot.oauthDeviceClientSecret!,
          snapshot.oauthRefreshToken
        )
      : preset.codebuddyPoll
        ? await refreshCodebuddyToken(preset, snapshot.oauthRefreshToken)
        : preset.profile === "cursor"
          ? await refreshCursorToken(preset, snapshot.oauthRefreshToken)
          : await refreshToken(preset, snapshot.oauthRefreshToken);
    const accessToken = tokens.access_token;
    if (!accessToken) return snapshot.oauthAccessToken;
    const refreshTokenValue = tokens.refresh_token ?? snapshot.oauthRefreshToken;
    const expiresAt =
      computeExpiry(tokens.expires_in) ??
      (preset.profile === "cursor" ? cursorAccessTokenExpiresAt(accessToken) : undefined);
    await saveProviderOAuthTokens(snapshot.id, {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresAt,
      deviceClientId: snapshot.oauthDeviceClientId,
      deviceClientSecret: snapshot.oauthDeviceClientSecret
    }, { accountId: account.id });
    return accessToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fatal =
      /revoked|invalid_grant|already.?used|shouldLogout|expired.*refresh|unauthorized|invalid_token/i.test(message);
    if (fatal || oauthTokenIsExpired(snapshot)) {
      try {
        await markOAuthAccountConnection(
          snapshot.id,
          account.id,
          false,
          `OAuth refresh failed: ${message.slice(0, 240)}. Reconnect this account.`
        );
      } catch {
        /* best-effort */
      }
    }
    return oauthTokenIsExpired(snapshot) ? null : snapshot.oauthAccessToken;
  }
}

/** Serialize refresh-token rotation per provider account. */
export function ensureFreshAccessToken(provider: ProviderConfig, accountId?: string): Promise<string | null> {
  const key = `${provider.id}:${accountId ?? "primary"}`;
  const existing = refreshFlights.get(key);
  if (existing) return existing;
  const flight = ensureFreshAccessTokenImpl(provider, accountId).finally(() => {
    if (refreshFlights.get(key) === flight) refreshFlights.delete(key);
  });
  refreshFlights.set(key, flight);
  return flight;
}

export async function loadProviderWithFreshToken(providerId: string): Promise<ProviderConfig | null> {
  const provider = await readProviderById(providerId);
  if (!provider) return null;
  await ensureFreshAccessToken(provider);
  const refreshed = await readProviderById(providerId);
  return refreshed ?? null;
}
