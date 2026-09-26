/**
 * Admin OAuth presets for NesaRouter login (GitHub, Google, etc.).
 * Client credentials are still read from env vars so each deployment can
 * register its own OAuth app, but URLs / scopes are centralized here so
 * adding a new provider is a one-line change.
 */

export interface AdminOAuthPreset {
  id: string;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  userinfoUrl?: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  responseType?: string;
}

export const adminOAuthPresets: AdminOAuthPreset[] = [
  {
    id: "github",
    label: "GitHub",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    userinfoUrl: "https://api.github.com/user/emails",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET"
  },
  {
    id: "google",
    label: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    responseType: "code"
  }
];

export function getAdminOAuthPreset(providerId: string) {
  return adminOAuthPresets.find((preset) => preset.id === providerId) ?? null;
}
