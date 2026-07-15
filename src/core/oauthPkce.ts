import crypto from "node:crypto";
import { OAuthPreset } from "@/core/oauthProviderPresets";

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function generatePkce(): PkcePair {
  const verifier = base64Url(crypto.randomBytes(64));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64Url(crypto.randomBytes(24));
}

export function buildAuthorizeUrl(preset: OAuthPreset, redirectUri: string, state: string, challenge: string): string {
  if (preset.tokenInCallback && preset.kimchiWebAppUrl) {
    const base = preset.kimchiWebAppUrl.replace(/\/+$/, "");
    return `${base}/cli-auth?${new URLSearchParams({ callback: redirectUri, state }).toString()}`;
  }
  if (preset.profile === "iflow") {
    const params = new URLSearchParams({
      loginMethod: preset.extraAuthorizeParams?.loginMethod ?? "phone",
      type: preset.extraAuthorizeParams?.type ?? "phone",
      redirect: redirectUri,
      state,
      client_id: preset.clientId
    });
    return `${preset.authorizeUrl}?${params.toString()}`;
  }
  if (preset.profile === "cline") {
    const params = new URLSearchParams({
      client_type: "extension",
      callback_url: redirectUri,
      redirect_uri: redirectUri
    });
    return `${preset.authorizeUrl}?${params.toString()}`;
  }

  const params: Record<string, string> = {
    response_type: "code",
    client_id: preset.clientId,
    redirect_uri: redirectUri,
    scope: preset.scope,
    state
  };
  if (!preset.skipPkce) {
    params.code_challenge = challenge;
    params.code_challenge_method = preset.codeChallengeMethod;
  }
  if (preset.extraAuthorizeParams) Object.assign(params, preset.extraAuthorizeParams);
  const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${preset.authorizeUrl}?${query}`;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

export async function exchangeCode(
  preset: OAuthPreset,
  code: string,
  redirectUri: string,
  codeVerifier: string,
  state?: string
): Promise<OAuthTokens> {
  if (preset.profile === "cline") {
    return exchangeClineCode(preset, code, redirectUri);
  }
  if (preset.profile === "iflow") {
    return exchangeIflowCode(preset, code, redirectUri);
  }

  const body: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    client_id: preset.clientId,
    redirect_uri: redirectUri
  };
  if (!preset.skipPkce) body.code_verifier = codeVerifier;
  if (preset.clientSecret) body.client_secret = preset.clientSecret;
  if (state && preset.tokenEncoding === "json") body.state = state;
  const response = await fetch(preset.tokenUrl, {
    method: "POST",
    headers: preset.tokenEncoding === "json"
      ? { "content-type": "application/json", accept: "application/json" }
      : { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: preset.tokenEncoding === "json" ? JSON.stringify(body) : new URLSearchParams(body).toString()
  });
  if (!response.ok) throw new Error(`OAuth token exchange failed: ${await response.text()}`);
  return await response.json();
}

async function exchangeIflowCode(preset: OAuthPreset, code: string, redirectUri: string): Promise<OAuthTokens> {
  const basicAuth = Buffer.from(`${preset.clientId}:${preset.clientSecret ?? ""}`).toString("base64");
  const response = await fetch(preset.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      authorization: `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: preset.clientId,
      client_secret: preset.clientSecret ?? ""
    }).toString()
  });
  if (!response.ok) throw new Error(`iFlow token exchange failed: ${await response.text()}`);
  return await response.json();
}

/** Resolve iFlow upstream API key from userInfo (preferred over OAuth access token for chat). */
export async function resolveIflowApiKey(preset: OAuthPreset, accessToken: string): Promise<string> {
  if (!preset.iflowUserInfoUrl) return accessToken;
  const response = await fetch(
    `${preset.iflowUserInfoUrl}?accessToken=${encodeURIComponent(accessToken)}`,
    { headers: { accept: "application/json" } }
  );
  if (!response.ok) throw new Error(`iFlow userInfo failed: ${await response.text()}`);
  const result = await response.json();
  const apiKey = result?.data?.apiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error("Empty API key returned from iFlow");
  return apiKey.trim();
}

async function exchangeClineCode(preset: OAuthPreset, code: string, redirectUri: string): Promise<OAuthTokens> {
  try {
    let base64 = code;
    const padding = 4 - (base64.length % 4);
    if (padding !== 4) base64 += "=".repeat(padding);
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const lastBrace = decoded.lastIndexOf("}");
    if (lastBrace === -1) throw new Error("No JSON in Cline code");
    const tokenData = JSON.parse(decoded.slice(0, lastBrace + 1));
    const expiresAt = tokenData.expiresAt ? new Date(tokenData.expiresAt).getTime() : undefined;
    return {
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
      expires_in: expiresAt ? Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)) : 3600
    };
  } catch {
    const response = await fetch(preset.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_type: "extension",
        redirect_uri: redirectUri
      })
    });
    if (!response.ok) throw new Error(`Cline token exchange failed: ${await response.text()}`);
    const data = await response.json();
    const access = data.data?.accessToken || data.accessToken;
    const refresh = data.data?.refreshToken || data.refreshToken;
    const expiresAt = data.data?.expiresAt || data.expiresAt;
    return {
      access_token: access,
      refresh_token: refresh,
      expires_in: expiresAt
        ? Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
        : 3600
    };
  }
}

export async function refreshToken(preset: OAuthPreset, refreshTokenValue: string): Promise<OAuthTokens> {
  const body: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
    client_id: preset.clientId
  };
  if (preset.clientSecret) body.client_secret = preset.clientSecret;
  if (preset.tokenEncoding === "form" && preset.scope) body.scope = preset.scope;
  const response = await fetch(preset.tokenUrl, {
    method: "POST",
    headers: preset.tokenEncoding === "json"
      ? { "content-type": "application/json", accept: "application/json" }
      : { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: preset.tokenEncoding === "json" ? JSON.stringify(body) : new URLSearchParams(body).toString()
  });
  if (!response.ok) throw new Error(`OAuth token refresh failed: ${await response.text()}`);
  return await response.json();
}

/** Cursor IDE refresh via api2.cursor.sh — treats shouldLogout as a hard re-import. */
export async function refreshCursorToken(preset: OAuthPreset, refreshTokenValue: string): Promise<OAuthTokens> {
  const response = await fetch(preset.tokenUrl || "https://api2.cursor.sh/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: preset.clientId,
      refresh_token: refreshTokenValue
    })
  });
  const data = await response.json().catch(() => ({}));
  if (data?.shouldLogout === true) {
    throw new Error("Cursor session revoked (shouldLogout). Re-import tokens from Cursor IDE.");
  }
  if (!response.ok) {
    throw new Error(`Cursor token refresh failed: ${typeof data === "object" ? JSON.stringify(data) : String(data)}`);
  }
  const access = data.access_token || data.accessToken;
  if (!access) throw new Error("Cursor refresh returned no access_token.");
  return {
    access_token: access,
    refresh_token: data.refresh_token || data.refreshToken || refreshTokenValue,
    expires_in: typeof data.expires_in === "number"
      ? data.expires_in
      : typeof data.expiresIn === "number"
        ? data.expiresIn
        : undefined
  };
}

export interface DeviceCodeInfo {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  /** PKCE verifier when devicePkce is enabled (Qwen). */
  codeVerifier?: string;
}

function pendingError(error: string, interval = 5): never {
  const err = new Error(error) as Error & { pending?: true; interval?: number };
  err.pending = true;
  err.interval = interval;
  throw err;
}

export async function startDeviceFlow(preset: OAuthPreset, codeChallenge?: string): Promise<DeviceCodeInfo> {
  if (preset.codebuddyPoll) return startCodebuddyDeviceFlow(preset);
  if (preset.kiloDeviceAuth) return startKiloDeviceFlow(preset);
  if (!preset.deviceCodeUrl) throw new Error("Preset does not support device flow.");

  const body = new URLSearchParams({ client_id: preset.clientId, scope: preset.scope });
  if (preset.deviceReferrer) body.set("referrer", preset.deviceReferrer);
  if (preset.devicePkce) {
    if (!codeChallenge) throw new Error("Device PKCE challenge required.");
    body.set("code_challenge", codeChallenge);
    body.set("code_challenge_method", preset.codeChallengeMethod);
  }

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json"
  };
  if (preset.profile === "grok_cli") {
    headers["User-Agent"] = preset.upstreamHeaders["User-Agent"] ?? "grok-pager/0.2.93";
  }

  const response = await fetch(preset.deviceCodeUrl, {
    method: "POST",
    headers,
    body: body.toString()
  });
  if (!response.ok) throw new Error(`Device code request failed: ${await response.text()}`);
  return await response.json();
}

export async function pollDeviceFlow(
  preset: OAuthPreset,
  deviceCode: string,
  codeVerifier?: string
): Promise<OAuthTokens> {
  if (preset.codebuddyPoll) return pollCodebuddyDeviceFlow(preset, deviceCode);
  if (preset.kiloDeviceAuth) return pollKiloDeviceFlow(preset, deviceCode);

  const body: Record<string, string> = {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode,
    client_id: preset.clientId
  };
  if (preset.devicePkce) {
    if (!codeVerifier) throw new Error("Device PKCE verifier required.");
    body.code_verifier = codeVerifier;
  }

  const headers: Record<string, string> = preset.deviceTokenJson
    ? { "content-type": "application/json", accept: "application/json" }
    : { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (preset.profile === "grok_cli") {
    headers["User-Agent"] = preset.upstreamHeaders["User-Agent"] ?? "grok-pager/0.2.93";
  }

  const response = await fetch(preset.tokenUrl, {
    method: "POST",
    headers,
    body: preset.deviceTokenJson ? JSON.stringify(body) : new URLSearchParams(body).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload as OAuthTokens;
  const error = payload?.error;
  if (error === "authorization_pending" || error === "slow_down") {
    pendingError(error, Number(payload?.interval ?? 5));
  }
  throw new Error(`Device flow failed: ${error ?? response.status} ${JSON.stringify(payload)}`);
}

async function startCodebuddyDeviceFlow(preset: OAuthPreset): Promise<DeviceCodeInfo> {
  const stateUrl = preset.codebuddyStateUrl;
  if (!stateUrl) throw new Error("CodeBuddy state URL missing.");
  const platform = preset.codebuddyPlatform ?? "CLI";
  const response = await fetch(`${stateUrl}?platform=${encodeURIComponent(platform)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "User-Agent": preset.codebuddyUserAgent ?? "CLI/2.63.2 CodeBuddy/2.63.2",
      "X-Requested-With": "XMLHttpRequest",
      "X-Domain": "copilot.tencent.com",
      "X-No-Authorization": "true",
      "X-No-User-Id": "true",
      "X-Product": "SaaS"
    },
    body: "{}"
  });
  if (!response.ok) throw new Error(`CodeBuddy state request failed: ${await response.text()}`);
  const data = await response.json();
  if (data.code !== 0 || !data.data?.state || !data.data?.authUrl) {
    throw new Error(`CodeBuddy state error: ${data.msg || "missing state/authUrl"}`);
  }
  return {
    device_code: data.data.state,
    user_code: "",
    verification_uri: data.data.authUrl,
    expires_in: 600,
    interval: 5
  };
}

async function pollCodebuddyDeviceFlow(preset: OAuthPreset, deviceCode: string): Promise<OAuthTokens> {
  const tokenUrl = preset.codebuddyTokenUrl ?? preset.tokenUrl;
  const response = await fetch(`${tokenUrl}?state=${encodeURIComponent(deviceCode)}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "User-Agent": preset.codebuddyUserAgent ?? "CLI/2.63.2 CodeBuddy/2.63.2",
      "X-Requested-With": "XMLHttpRequest",
      "X-Domain": "copilot.tencent.com",
      "X-No-Authorization": "true",
      "X-No-User-Id": "true",
      "X-No-Enterprise-Id": "true",
      "X-No-Department-Info": "true",
      "X-Product": "SaaS"
    }
  });
  if (!response.ok) throw new Error(`CodeBuddy token poll failed: ${response.status}`);
  const data = await response.json();
  if (data.code === 0 && data.data?.accessToken) {
    return {
      access_token: data.data.accessToken,
      refresh_token: data.data.refreshToken || undefined,
      expires_in: data.data.expiresIn
    };
  }
  if (data.code === 11217) pendingError("authorization_pending", 5);
  throw new Error(`CodeBuddy token error: ${data.msg || data.code}`);
}

export async function refreshCodebuddyToken(preset: OAuthPreset, refreshTokenValue: string): Promise<OAuthTokens> {
  const refreshUrl = preset.codebuddyRefreshUrl;
  if (!refreshUrl) throw new Error("CodeBuddy refresh URL missing.");
  const response = await fetch(refreshUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "User-Agent": preset.codebuddyUserAgent ?? "CLI/2.63.2 CodeBuddy/2.63.2",
      "X-Product": "SaaS"
    },
    body: JSON.stringify({ refreshToken: refreshTokenValue })
  });
  if (!response.ok) throw new Error(`CodeBuddy refresh failed: ${await response.text()}`);
  const data = await response.json();
  const access = data.data?.accessToken || data.accessToken || data.access_token;
  if (!access) throw new Error("CodeBuddy refresh returned no access token.");
  return {
    access_token: access,
    refresh_token: data.data?.refreshToken || data.refreshToken || data.refresh_token || refreshTokenValue,
    expires_in: data.data?.expiresIn || data.expires_in || 86400
  };
}

async function startKiloDeviceFlow(preset: OAuthPreset): Promise<DeviceCodeInfo> {
  const initiateUrl = preset.kiloInitiateUrl;
  if (!initiateUrl) throw new Error("Kilo initiate URL missing.");
  const response = await fetch(initiateUrl, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("Too many pending Kilo authorization requests. Try again later.");
    throw new Error(`Kilo device auth initiation failed: ${await response.text()}`);
  }
  const data = await response.json();
  return {
    device_code: data.code,
    user_code: data.code,
    verification_uri: data.verificationUrl,
    expires_in: Number(data.expiresIn ?? 300),
    interval: 3
  };
}

async function pollKiloDeviceFlow(preset: OAuthPreset, deviceCode: string): Promise<OAuthTokens> {
  const pollBase = preset.kiloPollUrlBase;
  if (!pollBase) throw new Error("Kilo poll URL missing.");
  const response = await fetch(`${pollBase}/${encodeURIComponent(deviceCode)}`);
  if (response.status === 202) pendingError("authorization_pending", 3);
  if (response.status === 403) throw new Error("Kilo authorization denied by user.");
  if (response.status === 410) throw new Error("Kilo authorization code expired.");
  if (!response.ok) throw new Error(`Kilo poll failed: ${response.status}`);
  const data = await response.json();
  if (data.status === "approved" && data.token) {
    return { access_token: data.token };
  }
  pendingError("authorization_pending", 3);
}

function kiroOidcBase(region: string) {
  return `https://oidc.${region}.amazonaws.com`;
}

/** Register a public OIDC client with AWS SSO (Builder ID / IDC device flow). */
export async function registerKiroOidcClient(preset: OAuthPreset): Promise<{ clientId: string; clientSecret: string }> {
  const region = preset.kiroRegion ?? "us-east-1";
  const response = await fetch(`${kiroOidcBase(region)}/client/register`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      clientName: preset.kiroClientName ?? "kiro-oauth-client",
      clientType: preset.kiroClientType ?? "public",
      scopes: preset.kiroScopes ?? preset.scope.split(/\s+/).filter(Boolean),
      grantTypes: preset.kiroGrantTypes ?? ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
      issuerUrl: preset.kiroIssuerUrl
    })
  });
  if (!response.ok) throw new Error(`Kiro OIDC register failed: ${await response.text()}`);
  const data = await response.json();
  if (!data?.clientId || !data?.clientSecret) throw new Error("Kiro OIDC register returned no client credentials.");
  return { clientId: data.clientId, clientSecret: data.clientSecret };
}

export async function startKiroDeviceFlow(
  preset: OAuthPreset,
  clientId: string,
  clientSecret: string
): Promise<DeviceCodeInfo & { clientId: string; clientSecret: string; region: string }> {
  const region = preset.kiroRegion ?? "us-east-1";
  const response = await fetch(`${kiroOidcBase(region)}/device_authorization`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      clientId,
      clientSecret,
      startUrl: preset.kiroStartUrl ?? "https://view.awsapps.com/start"
    })
  });
  if (!response.ok) throw new Error(`Kiro device authorization failed: ${await response.text()}`);
  const data = await response.json();
  return {
    device_code: data.deviceCode,
    user_code: data.userCode,
    verification_uri: data.verificationUri ?? data.verificationUriComplete ?? "https://view.awsapps.com/start",
    expires_in: Number(data.expiresIn ?? 600),
    interval: Number(data.interval ?? 5),
    clientId,
    clientSecret,
    region
  };
}

function normalizeAwsTokens(payload: any): OAuthTokens {
  return {
    access_token: payload.access_token ?? payload.accessToken,
    refresh_token: payload.refresh_token ?? payload.refreshToken,
    expires_in: payload.expires_in ?? payload.expiresIn,
    scope: payload.scope
  };
}

export async function pollKiroDeviceFlow(
  region: string,
  clientId: string,
  clientSecret: string,
  deviceCode: string
): Promise<OAuthTokens> {
  const response = await fetch(`${kiroOidcBase(region)}/token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      clientId,
      clientSecret,
      deviceCode,
      grantType: "urn:ietf:params:oauth:grant-type:device_code"
    })
  });
  const payload = await response.json().catch(() => ({}));
  const error = payload?.error;
  if (response.ok && !error) return normalizeAwsTokens(payload);
  if (error === "authorization_pending" || error === "slow_down") {
    const err = new Error(error) as Error & { pending?: true; interval?: number };
    err.pending = true;
    err.interval = Number(payload?.interval ?? 5);
    throw err;
  }
  throw new Error(`Kiro device flow failed: ${error ?? response.status} ${JSON.stringify(payload)}`);
}

export async function refreshKiroToken(
  region: string,
  clientId: string,
  clientSecret: string,
  refreshTokenValue: string
): Promise<OAuthTokens> {
  const response = await fetch(`${kiroOidcBase(region)}/token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      clientId,
      clientSecret,
      refreshToken: refreshTokenValue,
      grantType: "refresh_token"
    })
  });
  if (!response.ok) throw new Error(`Kiro token refresh failed: ${await response.text()}`);
  return normalizeAwsTokens(await response.json());
}

function cloudCodeAssistMetadata(preset: OAuthPreset): Record<string, string> {
  if (preset.profile === "antigravity") {
    return {
      ideType: "ANTIGRAVITY",
      platform: "PLATFORM_UNSPECIFIED",
      pluginType: "GEMINI"
    };
  }
  // gemini_cli (and any other loadCodeAssist consumer)
  return {
    ideType: "GEMINI_CLI",
    platform: "PLATFORM_UNSPECIFIED",
    pluginType: "GEMINI"
  };
}

export function cloudCodeAssistProbeMetadata(preset: OAuthPreset): Record<string, string> {
  return cloudCodeAssistMetadata(preset);
}

function extractCloudCodeProjectId(data: any): string | undefined {
  let projectId = data?.cloudaicompanionProject ?? data?.response?.cloudaicompanionProject;
  if (typeof projectId === "object" && projectId?.id) projectId = projectId.id;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Best-effort Cloud Code project id after Connect (Antigravity / Gemini CLI).
 * Tries loadCodeAssist first; if no project, polls onboardUser (FREE tier) until done.
 */
export async function loadAntigravityProjectId(preset: OAuthPreset, accessToken: string): Promise<string | undefined> {
  if (!preset.loadCodeAssistUrl) return undefined;
  const metadata = cloudCodeAssistMetadata(preset);
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${accessToken}`,
    ...preset.upstreamHeaders
  };

  try {
    const loadResponse = await fetch(preset.loadCodeAssistUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ metadata })
    });
    if (loadResponse.ok) {
      const data = await loadResponse.json().catch(() => null);
      const fromLoad = extractCloudCodeProjectId(data);
      if (fromLoad) return fromLoad;

      const currentTierId = data?.currentTier?.id;
      const allowed = Array.isArray(data?.allowedTiers) ? data.allowedTiers : [];
      const defaultTier = allowed.find((t: any) => t?.isDefault)?.id ?? allowed[0]?.id;
      const tierId = currentTierId && currentTierId !== "FREE"
        ? undefined
        : (defaultTier ?? "FREE");
      // Paid / user-defined tiers need an explicit GCP project — cannot onboard blindly.
      if (!tierId || tierId !== "FREE") return undefined;
    } else if (loadResponse.status >= 500) {
      return undefined;
    }

    const onboardUrl = preset.loadCodeAssistUrl.replace(":loadCodeAssist", ":onboardUser");
    if (onboardUrl === preset.loadCodeAssistUrl) return undefined;

    for (let attempt = 0; attempt < 10; attempt++) {
      const onboardResponse = await fetch(onboardUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ tierId: "FREE", metadata })
      });
      if (!onboardResponse.ok) return undefined;
      const payload = await onboardResponse.json().catch(() => null);
      const projectId = extractCloudCodeProjectId(payload);
      if (payload?.done && projectId) return projectId;
      if (payload?.done) return projectId;
      await sleep(5_000);
    }
  } catch {
    return undefined;
  }
  return undefined;
}
