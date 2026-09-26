import crypto from "node:crypto";
import { cookieSecurePreferred, publicUrl } from "@/core/publicUrl";
import { getAdminOAuthPreset } from "@/core/adminOAuthPresets";

export type OAuthProviderId = string;

export interface OAuthProviderInfo {
  id: OAuthProviderId;
  label: string;
  enabled: boolean;
}

export const oauthStateCookieName = "nesa_oauth_state";

export function availableOAuthProviders(): OAuthProviderInfo[] {
  return adminOAuthPresets.map((preset) => ({
    id: preset.id,
    label: preset.label,
    enabled: Boolean(process.env[preset.clientIdEnv] && process.env[preset.clientSecretEnv])
  }));
}

function requireOAuthEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required OAuth environment variable: ${name}`);
  return value;
}


export function enabledOAuthProvider(providerId: string) {
  return availableOAuthProviders().find((provider) => provider.id === providerId && provider.enabled);
}

export function createOAuthState(provider: OAuthProviderId) {
  return `${provider}:${crypto.randomBytes(24).toString("base64url")}`;
}

export function allowedOAuthEmails() {
  return (process.env.NESA_OAUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function assertOAuthEmailAllowed(email?: string) {
  const allowed = allowedOAuthEmails();
  if (!email) throw new Error("OAuth account does not expose an email address.");
  if (!allowed.length) throw new Error("Set NESA_OAUTH_ALLOWED_EMAILS before enabling OAuth login.");
  if (!allowed.includes(email.toLowerCase())) throw new Error("OAuth email is not allowed.");
}

export function oauthCookieOptions(request?: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecurePreferred(request),
    path: "/",
    maxAge: 10 * 60
  };
}

export function oauthCallbackUrl(request: Request, provider: OAuthProviderId) {
  return publicUrl(`/api/auth/oauth/${provider}/callback`, request);
}

export function oauthAuthorizeUrl(provider: OAuthProviderId, request: Request, state: string) {
  const preset = getAdminOAuthPreset(provider);
  if (!preset) throw new Error(`Unsupported OAuth provider: ${provider}`);

  const redirectUri = oauthCallbackUrl(request, provider);
  const url = new URL(preset.authorizeUrl);
  url.searchParams.set("client_id", process.env[preset.clientIdEnv] ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", preset.scope);
  url.searchParams.set("state", state);
  if (preset.responseType) {
    url.searchParams.set("response_type", preset.responseType);
  }
  return url;
}

async function postToken(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body)
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(result.error_description ?? result.error ?? "OAuth token exchange failed.");
  return String(result.access_token);
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`OAuth userinfo request failed (${response.status}).`);
  return response.json();
}

export async function resolveOAuthEmail(provider: OAuthProviderId, request: Request, code: string) {
  const preset = getAdminOAuthPreset(provider);
  if (!preset) throw new Error(`Unsupported OAuth provider: ${provider}`);

  const redirectUri = oauthCallbackUrl(request, provider);
  const token = await postToken(preset.tokenUrl, {
    client_id: process.env[preset.clientIdEnv] ?? "",
    client_secret: process.env[preset.clientSecretEnv] ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code
  });

  if (preset.id === "github") {
    const emails = await fetchJson("https://api.github.com/user/emails", {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`
    });
    const items = emails as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
    if (!Array.isArray(items)) throw new Error("GitHub email lookup returned unexpected data.");
    return items.find((item) => item.primary && item.verified)?.email ?? items.find((item) => item.verified)?.email;
  }

  if (preset.userinfoUrl) {
    const profile = await fetchJson(preset.userinfoUrl, {
      authorization: `Bearer ${token}`
    });
    if (preset.id === "google" && !profile.email_verified) {
      throw new Error("Google email is not verified.");
    }
    return (profile as { email?: string }).email;
  }

  throw new Error(`No email resolution implemented for OAuth provider: ${provider}`);
}
