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
  const params: Record<string, string> = {
    response_type: "code",
    client_id: preset.clientId,
    redirect_uri: redirectUri,
    scope: preset.scope,
    code_challenge: challenge,
    code_challenge_method: preset.codeChallengeMethod,
    state
  };
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
  const body: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    client_id: preset.clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  };
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

export interface DeviceCodeInfo {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export async function startDeviceFlow(preset: OAuthPreset): Promise<DeviceCodeInfo> {
  if (!preset.deviceCodeUrl) throw new Error("Preset does not support device flow.");
  const response = await fetch(preset.deviceCodeUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: preset.clientId, scope: preset.scope }).toString()
  });
  if (!response.ok) throw new Error(`Device code request failed: ${await response.text()}`);
  return await response.json();
}

export async function pollDeviceFlow(preset: OAuthPreset, deviceCode: string): Promise<OAuthTokens> {
  const body: Record<string, string> = {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode,
    client_id: preset.clientId
  };
  const response = await fetch(preset.tokenUrl, {
    method: "POST",
    headers: preset.deviceTokenJson
      ? { "content-type": "application/json", accept: "application/json" }
      : { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: preset.deviceTokenJson ? JSON.stringify(body) : new URLSearchParams(body).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload as OAuthTokens;
  const error = payload?.error;
  if (error === "authorization_pending" || error === "slow_down") {
    const err = new Error(error) as Error & { pending?: true; interval?: number };
    err.pending = true;
    err.interval = Number(payload?.interval ?? 5);
    throw err;
  }
  throw new Error(`Device flow failed: ${error ?? response.status} ${JSON.stringify(payload)}`);
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

/** Best-effort Cloud Code project id for Antigravity after Connect. */
export async function loadAntigravityProjectId(preset: OAuthPreset, accessToken: string): Promise<string | undefined> {
  if (!preset.loadCodeAssistUrl) return undefined;
  try {
    const response = await fetch(preset.loadCodeAssistUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
        ...preset.upstreamHeaders
      },
      body: JSON.stringify({
        metadata: { ideType: 9, platform: 5, pluginType: 2 }
      })
    });
    if (!response.ok) return undefined;
    const data = await response.json().catch(() => null);
    let projectId = data?.cloudaicompanionProject;
    if (typeof projectId === "object" && projectId?.id) projectId = projectId.id;
    return typeof projectId === "string" && projectId.trim() ? projectId.trim() : undefined;
  } catch {
    return undefined;
  }
}
