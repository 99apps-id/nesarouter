/**
 * OAuth presets for subscription-based providers (Claude, ChatGPT/Codex, Gemini CLI,
 * GitHub Copilot, Kiro Builder ID, Antigravity). Client IDs are the public CLI values;
 * tokens are stored encrypted and refreshed automatically.
 */

export type OAuthProfile =
  | "anthropic_claude"
  | "openai_codex"
  | "gemini_cli"
  | "github_copilot"
  | "kiro"
  | "antigravity"
  | "cursor";

export interface OAuthPreset {
  profile: OAuthProfile;
  displayName: string;
  clientId: string;
  /** OAuth confidential-client secret (public CLI values for Gemini/Antigravity). */
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  codeChallengeMethod: "S256";
  /** "json" sends token exchange as JSON; "form" as application/x-www-form-urlencoded. */
  tokenEncoding: "json" | "form";
  providerType: "anthropic_messages" | "openai_responses" | "gemini_cli" | "github_copilot" | "kiro" | "cursor";
  baseUrl: string;
  defaultModel: string;
  models?: string[];
  /** Extra headers required for upstream calls (e.g. CLI identity headers). */
  upstreamHeaders: Record<string, string>;
  /** Extra params appended to the authorize URL. */
  extraAuthorizeParams?: Record<string, string>;
  /** Refresh lead time in ms (refresh if expiry within this window). */
  refreshLeadMs: number;
  /** Device-code flow (GitHub Copilot / Kiro AWS Builder ID). */
  deviceFlow?: boolean;
  deviceCodeUrl?: string;
  deviceTokenJson?: boolean;
  /** Kiro AWS SSO OIDC registration (Builder ID). */
  kiroDeviceFlow?: boolean;
  kiroRegion?: string;
  kiroStartUrl?: string;
  kiroClientName?: string;
  kiroClientType?: string;
  kiroScopes?: string[];
  kiroGrantTypes?: string[];
  kiroIssuerUrl?: string;
  /** Copilot-specific: exchange GitHub access token for Copilot session token. */
  copilotTokenUrl?: string;
  copilotHeaders?: Record<string, string>;
  /** Antigravity: load project after Connect. */
  loadCodeAssistUrl?: string;
  skipPkce?: boolean;
  /** Cursor IDE: import token from local state.vscdb (no browser OAuth). */
  importTokenFlow?: boolean;
  /** When set, use this redirect_uri instead of the NesaRouter callback URL (CLI public clients). */
  fixedRedirectUri?: string;
  /** After authorize, user pastes the code shown by the vendor (Claude / Gemini remote flows). */
  manualCodeFlow?: boolean;
  /** Fixed loopback listener for CLI clients that only allow localhost redirects (e.g. Codex :1455). */
  loopbackPort?: number;
  loopbackPath?: string;
  cursorClientVersion?: string;
  cursorClientType?: string;
}

export const OAUTH_PRESETS: Record<OAuthProfile, OAuthPreset> = {
  anthropic_claude: {
    profile: "anthropic_claude",
    displayName: "Claude (Anthropic subscription)",
    clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
    authorizeUrl: "https://claude.ai/oauth/authorize",
    tokenUrl: "https://api.anthropic.com/v1/oauth/token",
    scope: "org:create_api_key user:profile user:inference",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "anthropic_messages",
    baseUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-5",
    upstreamHeaders: {
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    // Claude Code public client — console page shows a pasteable code (works on VPS too).
    fixedRedirectUri: "https://console.anthropic.com/oauth/code/callback",
    manualCodeFlow: true,
    extraAuthorizeParams: { code: "true" },
    refreshLeadMs: 15 * 60_000
  },
  openai_codex: {
    profile: "openai_codex",
    displayName: "ChatGPT (Codex)",
    clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
    authorizeUrl: "https://auth.openai.com/oauth/authorize",
    tokenUrl: "https://auth.openai.com/oauth/token",
    scope: "openid profile email offline_access",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    providerType: "openai_responses",
    baseUrl: "https://chatgpt.com/backend-api/codex/responses",
    defaultModel: "gpt-5.6-sol",
    upstreamHeaders: {
      originator: "codex_cli_rs",
      "User-Agent": "codex_cli_rs/0.136.0"
    },
    extraAuthorizeParams: {
      id_token_add_organizations: "true",
      codex_cli_simplified_flow: "true",
      originator: "codex_cli_rs"
    },
    // Codex public client only allows this exact loopback redirect.
    fixedRedirectUri: "http://localhost:1455/auth/callback",
    loopbackPort: 1455,
    loopbackPath: "/auth/callback",
    refreshLeadMs: 60 * 60_000
  },
  gemini_cli: {
    profile: "gemini_cli",
    displayName: "Gemini CLI (Google subscription)",
    clientId: "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
    clientSecret: "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",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    providerType: "gemini_cli",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
    defaultModel: "gemini-3-pro-preview",
    upstreamHeaders: {
      "X-Goog-Api-Client": "google-genai-sdk/1.41.0 gl-node/v22.19.0",
      "User-Agent": "google-genai-sdk/1.41.0 gl-node/v22.19.0"
    },
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    // Gemini CLI remote / headless flow — paste the code from Google's page.
    fixedRedirectUri: "https://codeassist.google.com/authcode",
    manualCodeFlow: true,
    refreshLeadMs: 10 * 60_000
  },
  github_copilot: {
    profile: "github_copilot",
    displayName: "GitHub Copilot",
    clientId: "Iv1.b507a08c87ecfe98",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    deviceCodeUrl: "https://github.com/login/device/code",
    scope: "read:user",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    deviceFlow: true,
    deviceTokenJson: true,
    providerType: "github_copilot",
    baseUrl: "https://api.githubcopilot.com/chat/completions",
    defaultModel: "gpt-5.4",
    upstreamHeaders: {
      "copilot-integration-id": "vscode-chat",
      "editor-version": "vscode/1.110.0",
      "editor-plugin-version": "copilot-chat/0.38.0",
      "user-agent": "GitHubCopilotChat/0.38.0",
      "openai-intent": "conversation-panel",
      "x-github-api-version": "2025-04-01",
      "x-vscode-user-agent-library-version": "electron-fetch",
      "X-Initiator": "user"
    },
    copilotTokenUrl: "https://api.github.com/copilot_internal/v2/token",
    copilotHeaders: {
      "editor-version": "vscode/1.110.0",
      "editor-plugin-version": "copilot-chat/0.38.0",
      "user-agent": "GitHubCopilotChat/0.38.0",
      "x-github-api-version": "2025-04-01"
    },
    refreshLeadMs: 5 * 60_000
  },
  kiro: {
    profile: "kiro",
    displayName: "Kiro (AWS Builder ID)",
    clientId: "kiro-oauth-client",
    authorizeUrl: "https://view.awsapps.com/start",
    tokenUrl: "https://oidc.us-east-1.amazonaws.com/token",
    scope: "codewhisperer:completions codewhisperer:analysis codewhisperer:conversations",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    deviceFlow: true,
    kiroDeviceFlow: true,
    kiroRegion: "us-east-1",
    kiroStartUrl: "https://view.awsapps.com/start",
    kiroClientName: "kiro-oauth-client",
    kiroClientType: "public",
    kiroScopes: [
      "codewhisperer:completions",
      "codewhisperer:analysis",
      "codewhisperer:conversations"
    ],
    kiroGrantTypes: [
      "urn:ietf:params:oauth:grant-type:device_code",
      "refresh_token"
    ],
    kiroIssuerUrl: "https://identitycenter.amazonaws.com/ssoins-722374e8c3c8e6c6",
    providerType: "kiro",
    baseUrl: "https://runtime.us-east-1.kiro.dev/generateAssistantResponse",
    defaultModel: "claude-sonnet-4.5",
    models: ["claude-sonnet-4.5", "claude-haiku-4.5", "deepseek-3.2", "qwen3-coder-next", "glm-5", "MiniMax-M2.5"],
    upstreamHeaders: {},
    refreshLeadMs: 10 * 60_000
  },
  antigravity: {
    profile: "antigravity",
    displayName: "Antigravity (Google)",
    clientId: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
    clientSecret: "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",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/cclog",
      "https://www.googleapis.com/auth/experimentsandconfigs"
    ].join(" "),
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    providerType: "gemini_cli",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
    defaultModel: "gemini-3-flash",
    models: [
      "gemini-3-flash",
      "gemini-3-flash-agent",
      "gemini-3.1-pro-low",
      "gemini-pro-agent",
      "claude-sonnet-4-6"
    ],
    upstreamHeaders: {
      "User-Agent": "antigravity/ide/2.1.1",
      "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
      "Client-Metadata": JSON.stringify({ ideType: 9, platform: 5, pluginType: 2 })
    },
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    loadCodeAssistUrl: "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
    // Google installed-app clients require a loopback redirect (any free port).
    fixedRedirectUri: "http://127.0.0.1:51121/oauth2callback",
    loopbackPort: 51121,
    loopbackPath: "/oauth2callback",
    refreshLeadMs: 5 * 60_000
  },
  cursor: {
    profile: "cursor",
    displayName: "Cursor IDE",
    clientId: "cursor-ide",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    importTokenFlow: true,
    cursorClientVersion: "3.1.0",
    cursorClientType: "ide",
    providerType: "cursor",
    baseUrl: "https://api2.cursor.sh",
    defaultModel: "default",
    models: [
      "default",
      "claude-4.5-sonnet",
      "claude-4.5-sonnet-thinking",
      "claude-4.5-opus-high",
      "claude-4.6-opus-max",
      "gpt-5.2",
      "gpt-5.3-codex",
      "gemini-3-flash-preview",
      "kimi-k2.5"
    ],
    upstreamHeaders: {},
    refreshLeadMs: 60 * 60_000
  }
};

export function getPreset(profile: OAuthProfile | undefined): OAuthPreset | undefined {
  if (!profile) return undefined;
  return OAUTH_PRESETS[profile];
}
