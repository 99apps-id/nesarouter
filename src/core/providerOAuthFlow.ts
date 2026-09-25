import { getPreset, type OAuthPreset, type OAuthProfile } from "@/core/oauthProviderPresets";
import { refreshCodebuddyToken, refreshCursorToken, refreshKiroToken, refreshToken, type OAuthTokens } from "@/core/oauthPkce";
import { configuredOAuthAccounts, providerForOAuthAccount } from "@/core/oauthAccounts";
import { cursorAccessTokenExpiresAt } from "@/core/cursorTokenImport";
import { ProviderConfig } from "@/core/types";
import { readProviderById } from "@/lib/store";
import { markOAuthAccountConnection, saveProviderOAuthTokens } from "@/lib/providerOAuthPersistence";

const UNKNOWN_EXPIRY_REFRESH_INTERVAL_MS = 45 * 60_000;

/**
 * Upstream-style per-provider refresh profiles.
 * Keys not listed fall back to generic form-encoded OAuth2 refresh
 * with client_id + client_secret (unless includeClientSecret is false).
 */
const REFRESH_PROFILES: Record<string, {
  bodyFormat?: "json" | "form";
  includeClientSecret?: boolean | ((config: OAuthPreset) => boolean);
  extraHeaders?: (credentials: { oauthRefreshToken: string }, config: OAuthPreset) => Record<string, string>;
}> = {
  anthropic_claude: {
    bodyFormat: "json",
    includeClientSecret: false,
  },
  iflow: {
    includeClientSecret: (config) => Boolean(config.clientSecret),
  },
  github_copilot: {
    includeClientSecret: (config) => Boolean(config.clientSecret),
  },
  kimi: {
    extraHeaders: () => ({
      "X-Msh-Device-Id": "",
    }),
  },
  trae: {
    bodyFormat: "json",
    includeClientSecret: true,
    extraHeaders: () => ({
      "User-Agent": "Trae/1.0.0 antigravity-cockpit-tools",
    }),
  },
  clinepass: {
    bodyFormat: "json",
    includeClientSecret: true,
    extraHeaders: () => ({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
  },
  cline: {
    bodyFormat: "json",
    includeClientSecret: true,
    extraHeaders: () => ({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
  },
  codebuddy_intl: {
    bodyFormat: "json",
    includeClientSecret: false,
    extraHeaders: () => ({
      "X-Refresh-Token": "",
    }),
  },
};

export function classifyOAuthRefreshError(errorText = "", status = 0): { permanent: boolean; code?: string; description?: string; status?: number } {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = errorText ? JSON.parse(errorText) : null;
  } catch {
    parsed = null;
  }

  const errorObj = typeof parsed?.error === "object" && parsed?.error !== null ? (parsed.error as Record<string, unknown>) : null;
  const code = typeof parsed?.error === "string" ? parsed.error : typeof errorObj?.code === "string" ? errorObj.code : "";
  const description = typeof parsed?.error_description === "string" ? parsed.error_description : typeof parsed?.message === "string" ? parsed.message : errorText;
  const combined = `${code} ${description}`.toLowerCase();

  const permanent = [
    "refresh_token_expired",
    "refresh_token_reused",
    "refresh_token_invalidated",
    "invalid_grant",
  ].some((marker) => combined.includes(marker));

  return { status, code, description, permanent };
}

export function oauthTokenIsExpired(provider: Pick<ProviderConfig, "oauthTokenExpiresAt">, now = Date.now()): boolean {
  if (!provider.oauthTokenExpiresAt) return false;
  const expiresAt = new Date(provider.oauthTokenExpiresAt).getTime();
  // A persisted but malformed expiry must fail closed. Treating it as an
  // unknown-expiry token can keep a broken credential routable forever.
  return !Number.isFinite(expiresAt) || expiresAt <= now;
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
  return !Number.isFinite(expiresAt) || now + (preset.refreshLeadMs ?? 5 * 60_000) >= expiresAt;
}

function computeExpiry(expiresIn?: number): string | undefined {
  if (!expiresIn) return undefined;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function refreshWithProfile(preset: OAuthPreset, refreshTokenValue: string): Promise<OAuthTokens> {
  const profile = REFRESH_PROFILES[preset.profile as OAuthProfile];
  const encoding = profile?.bodyFormat ?? preset.tokenEncoding;
  const body: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
    client_id: preset.clientId
  };
  const includeSecret = typeof profile?.includeClientSecret === "function"
    ? profile.includeClientSecret(preset)
    : profile?.includeClientSecret ?? true;
  if (includeSecret && preset.clientSecret) body.client_secret = preset.clientSecret;
  if (encoding === "form" && preset.scope) body.scope = preset.scope;
  const url = preset.refreshUrl ?? preset.tokenUrl;
  const headers: Record<string, string> = encoding === "json"
    ? { "content-type": "application/json", accept: "application/json" }
    : { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (profile?.extraHeaders) {
    Object.assign(headers, profile.extraHeaders({ oauthRefreshToken: refreshTokenValue }, preset));
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: encoding === "json" ? JSON.stringify(body) : new URLSearchParams(body).toString()
  });
  if (!response.ok) {
    const errorText = await response.text();
    const classification = classifyOAuthRefreshError(errorText, response.status);
    if (classification.permanent) {
      const err = new Error(classification.description || `OAuth refresh failed (${response.status})`) as Error & { permanent: boolean };
      err.permanent = true;
      throw err;
    }
    throw new Error(`OAuth refresh failed (${response.status}): ${classification.description || errorText}`);
  }
  const data = await response.json();
  const accessToken = data.access_token || data.AccessToken;
  if (!accessToken) throw new Error("OAuth refresh returned no access token.");
  const refreshToken = data.refresh_token || data.RefreshToken || refreshTokenValue;
  const expiresIn = data.expires_in ?? data.expiresIn;
  return { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn };
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
  return Date.now() + (preset.refreshLeadMs ?? 5 * 60_000) >= expiresAt;
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
          : await refreshWithProfile(preset, snapshot.oauthRefreshToken);
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
    const classification = classifyOAuthRefreshError(message);
    const fatal =
      /revoked|already.?used|shouldLogout|expired.*refresh|unauthorized|invalid_token/i.test(message) ||
      classification.permanent;
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
