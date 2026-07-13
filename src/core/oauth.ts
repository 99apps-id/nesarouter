import crypto from "node:crypto";
import { cookieSecurePreferred, publicUrl } from "@/core/publicUrl";

export type OAuthProviderId = "github" | "google";

export interface OAuthProviderInfo {
  id: OAuthProviderId;
  label: string;
  enabled: boolean;
}

export const oauthStateCookieName = "nesa_oauth_state";

export function availableOAuthProviders(): OAuthProviderInfo[] {
  return [
    {
      id: "github",
      label: "GitHub",
      enabled: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
    },
    {
      id: "google",
      label: "Google",
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    }
  ];
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
  const redirectUri = oauthCallbackUrl(request, provider);
  if (provider === "github") {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    return url;
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
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

export async function resolveOAuthEmail(provider: OAuthProviderId, request: Request, code: string) {
  const redirectUri = oauthCallbackUrl(request, provider);
  if (provider === "github") {
    const token = await postToken("https://github.com/login/oauth/access_token", {
      client_id: process.env.GITHUB_CLIENT_ID ?? "",
      client_secret: process.env.GITHUB_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      code
    });
    const response = await fetch("https://api.github.com/user/emails", {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}` }
    });
    const emails = (await response.json()) as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
    if (!response.ok || !Array.isArray(emails)) throw new Error("GitHub email lookup failed.");
    return emails.find((item) => item.primary && item.verified)?.email ?? emails.find((item) => item.verified)?.email;
  }

  const token = await postToken("https://oauth2.googleapis.com/token", {
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code
  });
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token}` }
  });
  const profile = (await response.json()) as { email?: string; email_verified?: boolean };
  if (!response.ok || !profile.email_verified) throw new Error("Google email lookup failed.");
  return profile.email;
}
