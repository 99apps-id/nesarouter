/**
 * OAuth presets for subscription-based providers (Claude, ChatGPT/Codex, Gemini CLI,
 * GitHub Copilot, Kiro Builder ID, Antigravity, Cursor, plus 9router specialty flows).
 * Client IDs are the public CLI values; tokens are stored encrypted and refreshed automatically.
 */

export type OAuthProfile =
  | "anthropic_claude"
  | "openai_codex"
  | "gemini_cli"
  | "github_copilot"
  | "kiro"
  | "antigravity"
  | "cursor"
  | "qwen_code"
  | "grok_cli"
  | "kimchi"
  | "iflow"
  | "codebuddy_cn"
  | "cline"
  | "kilocode";

export type OAuthProviderType =
  | "anthropic_messages"
  | "openai_responses"
  | "gemini_cli"
  | "github_copilot"
  | "kiro"
  | "cursor"
  | "openai_compatible";

export interface OAuthPreset {
  profile: OAuthProfile;
  displayName: string;
  clientId: string;
  /** OAuth confidential-client secret (public CLI values for Gemini/Antigravity/iFlow). */
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  codeChallengeMethod: "S256";
  /** "json" sends token exchange as JSON; "form" as application/x-www-form-urlencoded. */
  tokenEncoding: "json" | "form";
  providerType: OAuthProviderType;
  baseUrl: string;
  defaultModel: string;
  models?: string[];
  /** Extra headers required for upstream calls (e.g. CLI identity headers). */
  upstreamHeaders: Record<string, string>;
  /** Extra params appended to the authorize URL. */
  extraAuthorizeParams?: Record<string, string>;
  /** Refresh lead time in ms (refresh if expiry within this window). */
  refreshLeadMs: number;
  /** Device-code flow (GitHub Copilot / Kiro / Qwen / Grok CLI / …). */
  deviceFlow?: boolean;
  deviceCodeUrl?: string;
  deviceTokenJson?: boolean;
  /** Device start/poll must include PKCE (Qwen Code). */
  devicePkce?: boolean;
  /** Extra form field on device-code start (Grok CLI `referrer`). */
  deviceReferrer?: string;
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
  /** Kimchi: loopback delivers `?token=` (no authorization-code exchange). */
  tokenInCallback?: boolean;
  /** Kimchi web app base for `/cli-auth`. */
  kimchiWebAppUrl?: string;
  /** iFlow userInfo endpoint (returns API key after OAuth). */
  iflowUserInfoUrl?: string;
  /** CodeBuddy browser poll: POST state → open authUrl → GET token?state=. */
  codebuddyPoll?: boolean;
  codebuddyStateUrl?: string;
  codebuddyTokenUrl?: string;
  codebuddyRefreshUrl?: string;
  codebuddyUserAgent?: string;
  codebuddyPlatform?: string;
  /** Kilo custom device-auth codes API. */
  kiloDeviceAuth?: boolean;
  kiloInitiateUrl?: string;
  kiloPollUrlBase?: string;
  kiloApiBaseUrl?: string;
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
    fixedRedirectUri: "https://console.anthropic.com/oauth/code/callback",
    manualCodeFlow: true,
    extraAuthorizeParams: { code: "true" },
    refreshLeadMs: 15 * 60_000
  },
  openai_codex: {
    profile: "openai_codex",
    displayName: "Codex",
    clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
    authorizeUrl: "https://auth.openai.com/oauth/authorize",
    tokenUrl: "https://auth.openai.com/oauth/token",
    scope: "openid profile email offline_access",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    providerType: "openai_responses",
    baseUrl: "https://chatgpt.com/backend-api/codex/responses",
    defaultModel: "gpt-5.6-sol",
    models: [
      "gpt-5.6-sol",
      "gpt-5.6-sol-review",
      "gpt-5.6-terra",
      "gpt-5.6-terra-review",
      "gpt-5.6-luna",
      "gpt-5.6-luna-review",
      "gpt-5.5",
      "gpt-5.5-review",
      "gpt-5.4",
      "gpt-5.4-review",
      "gpt-5.4-mini",
      "gpt-5.4-mini-review",
      "gpt-5.3-codex-spark",
      "gpt-5.3-codex-spark-review"
    ],
    upstreamHeaders: {
      originator: "codex_cli_rs",
      "User-Agent": "codex_cli_rs/0.136.0"
    },
    extraAuthorizeParams: {
      id_token_add_organizations: "true",
      codex_cli_simplified_flow: "true",
      originator: "codex_cli_rs"
    },
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
    models: ["gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
    upstreamHeaders: {
      "X-Goog-Api-Client": "google-genai-sdk/1.41.0 gl-node/v22.19.0",
      "User-Agent": "google-genai-sdk/1.41.0 gl-node/v22.19.0"
    },
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    loadCodeAssistUrl: "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
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
    kiroGrantTypes: ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
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
    models: ["gemini-3-flash", "gemini-3-flash-agent", "gemini-3.1-pro-low", "gemini-pro-agent", "claude-sonnet-4-6"],
    upstreamHeaders: {
      "User-Agent": "antigravity/ide/2.1.1",
      "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
      "Client-Metadata": JSON.stringify({ ideType: 9, platform: 5, pluginType: 2 })
    },
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    loadCodeAssistUrl: "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
    fixedRedirectUri: "http://127.0.0.1:51121/oauth2callback",
    loopbackPort: 51121,
    loopbackPath: "/oauth2callback",
    refreshLeadMs: 5 * 60_000
  },
  cursor: {
    profile: "cursor",
    displayName: "Cursor IDE",
    clientId: "KbZUR41cY7W6zRSdpSUJ7I7mLYBKOCmB",
    authorizeUrl: "",
    tokenUrl: "https://api2.cursor.sh/oauth/token",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
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
  },

  qwen_code: {
    profile: "qwen_code",
    displayName: "Qwen Code",
    clientId: "f0304373b74a44d2b584a3fb70ca9e56",
    authorizeUrl: "https://chat.qwen.ai",
    tokenUrl: "https://chat.qwen.ai/api/v1/oauth2/token",
    deviceCodeUrl: "https://chat.qwen.ai/api/v1/oauth2/device/code",
    scope: "openid profile email model.completion",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    deviceFlow: true,
    devicePkce: true,
    providerType: "openai_compatible",
    baseUrl: "https://portal.qwen.ai/v1",
    defaultModel: "qwen3-coder-plus",
    models: ["qwen3-coder-plus", "qwen3-coder-flash", "vision-model", "coder-model"],
    upstreamHeaders: {},
    refreshLeadMs: 20 * 60_000
  },
  grok_cli: {
    profile: "grok_cli",
    displayName: "Grok CLI (Grok Build)",
    clientId: "b1a00492-073a-47ea-816f-4c329264a828",
    authorizeUrl: "https://auth.x.ai/oauth2/auth",
    tokenUrl: "https://auth.x.ai/oauth2/token",
    deviceCodeUrl: "https://auth.x.ai/oauth2/device/code",
    scope:
      "openid profile email offline_access grok-cli:access api:access conversations:read conversations:write",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    deviceFlow: true,
    deviceReferrer: "grok-build",
    providerType: "openai_responses",
    baseUrl: "https://cli-chat-proxy.grok.com/v1/responses",
    defaultModel: "grok-4.5",
    models: ["grok-4.5", "grok-4.5-high", "grok-4.5-medium", "grok-4.5-low"],
    upstreamHeaders: {
      "User-Agent": "grok-pager/0.2.93 grok-shell/0.2.93 (linux; x86_64)",
      "x-xai-token-auth": "xai-grok-cli",
      "x-grok-client-identifier": "grok-pager",
      "x-grok-client-version": "0.2.93",
      "x-authenticateresponse": "authenticate-response"
    },
    refreshLeadMs: 5 * 60_000
  },
  kimchi: {
    profile: "kimchi",
    displayName: "Kimchi",
    clientId: "kimchi-cli",
    authorizeUrl: "https://app.kimchi.dev/cli-auth",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    tokenInCallback: true,
    kimchiWebAppUrl: "https://app.kimchi.dev",
    skipPkce: true,
    providerType: "openai_compatible",
    baseUrl: "https://llm.kimchi.dev/openai/v1",
    defaultModel: "kimi-k2.7",
    models: [
      "minimax-m3",
      "kimi-k2.7",
      "kimi-k2.6",
      "kimi-k2.5",
      "nemotron-3-ultra-fp4",
      "minimax-m2.7",
      "claude-opus-4-6",
      "claude-sonnet-4-6"
    ],
    upstreamHeaders: { "User-Agent": "kimchi/0.1.50" },
    fixedRedirectUri: "http://127.0.0.1:51888/callback",
    loopbackPort: 51888,
    loopbackPath: "/callback",
    refreshLeadMs: 24 * 60 * 60_000
  },
  iflow: {
    profile: "iflow",
    displayName: "iFlow AI (OAuth)",
    clientId: "10009311001",
    clientSecret: "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW",
    authorizeUrl: "https://iflow.cn/oauth",
    tokenUrl: "https://iflow.cn/oauth/token",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    iflowUserInfoUrl: "https://iflow.cn/api/oauth/getUserInfo",
    extraAuthorizeParams: { loginMethod: "phone", type: "phone" },
    skipPkce: true,
    providerType: "openai_compatible",
    baseUrl: "https://apis.iflow.cn/v1",
    defaultModel: "qwen3-coder-plus",
    models: [
      "qwen3-coder-plus",
      "qwen3-max",
      "qwen3-vl-plus",
      "qwen3-235b",
      "kimi-k2",
      "deepseek-v3.2",
      "deepseek-r1",
      "glm-4.7",
      "iflow-rome-30ba3b"
    ],
    upstreamHeaders: { "User-Agent": "iFlow-Cli" },
    fixedRedirectUri: "http://127.0.0.1:51889/callback",
    loopbackPort: 51889,
    loopbackPath: "/callback",
    refreshLeadMs: 24 * 60 * 60_000
  },
  codebuddy_cn: {
    profile: "codebuddy_cn",
    displayName: "CodeBuddy CN (OAuth)",
    clientId: "codebuddy-cn",
    authorizeUrl: "https://copilot.tencent.com",
    tokenUrl: "https://copilot.tencent.com/v2/plugin/auth/token",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    deviceFlow: true,
    codebuddyPoll: true,
    codebuddyStateUrl: "https://copilot.tencent.com/v2/plugin/auth/state",
    codebuddyTokenUrl: "https://copilot.tencent.com/v2/plugin/auth/token",
    codebuddyRefreshUrl: "https://copilot.tencent.com/v2/plugin/auth/token/refresh",
    codebuddyUserAgent: "CLI/2.63.2 CodeBuddy/2.63.2",
    codebuddyPlatform: "CLI",
    providerType: "openai_compatible",
    baseUrl: "https://copilot.tencent.com/v2",
    defaultModel: "glm-5.2",
    models: [
      "glm-5.2",
      "glm-5.1",
      "glm-5.0",
      "glm-5.0-turbo",
      "minimax-m3",
      "minimax-m2.7",
      "kimi-k2.7",
      "kimi-k2.6",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "deepseek-v3-2-volc",
      "hy3-preview"
    ],
    upstreamHeaders: {
      "User-Agent": "CLI/2.108.1 CodeBuddy/2.108.1",
      "X-Product": "SaaS",
      "X-IDE-Type": "CLI",
      "X-IDE-Name": "CLI",
      "x-requested-with": "XMLHttpRequest",
      "x-codebuddy-request": "1"
    },
    refreshLeadMs: 10 * 60_000
  },
  cline: {
    profile: "cline",
    displayName: "Cline (OAuth)",
    clientId: "cline-extension",
    authorizeUrl: "https://api.cline.bot/api/v1/auth/authorize",
    tokenUrl: "https://api.cline.bot/api/v1/auth/token",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    skipPkce: true,
    providerType: "openai_compatible",
    baseUrl: "https://api.cline.bot/api/v1",
    defaultModel: "anthropic/claude-sonnet-4.6",
    models: [
      "anthropic/claude-opus-4.7",
      "anthropic/claude-sonnet-4.6",
      "anthropic/claude-opus-4.6",
      "openai/gpt-5.4",
      "openai/gpt-5.3-codex",
      "google/gemini-3.1-pro-preview",
      "google/gemini-3.1-flash-lite-preview",
      "kwaipilot/kat-coder-pro"
    ],
    upstreamHeaders: {
      "HTTP-Referer": "https://cline.bot",
      "X-Title": "Cline",
      "X-CLIENT-TYPE": "nesarouter"
    },
    fixedRedirectUri: "http://127.0.0.1:51890/callback",
    loopbackPort: 51890,
    loopbackPath: "/callback",
    refreshLeadMs: 10 * 60_000
  },
  kilocode: {
    profile: "kilocode",
    displayName: "Kilo Code (OAuth)",
    clientId: "kilocode",
    authorizeUrl: "https://kilocode.ai",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    deviceFlow: true,
    kiloDeviceAuth: true,
    kiloInitiateUrl: "https://api.kilo.ai/api/device-auth/codes",
    kiloPollUrlBase: "https://api.kilo.ai/api/device-auth/codes",
    kiloApiBaseUrl: "https://api.kilo.ai",
    providerType: "openai_compatible",
    baseUrl: "https://api.kilo.ai/api/openrouter",
    defaultModel: "anthropic/claude-sonnet-4-20250514",
    models: [
      "anthropic/claude-sonnet-4-20250514",
      "anthropic/claude-opus-4-20250514",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "openai/gpt-4.1",
      "openai/o3",
      "deepseek/deepseek-chat",
      "deepseek/deepseek-reasoner"
    ],
    upstreamHeaders: {},
    refreshLeadMs: 24 * 60 * 60_000
  }
};

export function getPreset(profile: OAuthProfile | undefined): OAuthPreset | undefined {
  if (!profile) return undefined;
  return OAUTH_PRESETS[profile];
}

export function usesOAuthDeviceFlow(preset: OAuthPreset | undefined): boolean {
  if (!preset) return false;
  return Boolean(preset.deviceFlow || preset.kiroDeviceFlow || preset.codebuddyPoll || preset.kiloDeviceAuth);
}

export function usesOAuthLoopback(preset: OAuthPreset | undefined): boolean {
  return Boolean(preset?.loopbackPort && preset.loopbackPath);
}
