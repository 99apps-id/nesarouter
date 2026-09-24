/**
 * OAuth presets for subscription-based providers (Claude, ChatGPT/Codex, Gemini CLI,
 * GitHub Copilot, Kiro Builder ID, Antigravity, Cursor, plus NesaRouter specialty flows).
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
  | "codebuddy_intl"
  | "cline"
  | "clinepass"
  | "kilocode"
  | "kimi"
  | "qoder"
  | "qoder_cn"
  | "trae"
  | "xiaomi_mimo"
  | "gitlab"
  | "windsurf"
  | "zed";

export type OAuthProviderType =
  | "anthropic_messages"
  | "openai_responses"
  | "gemini_cli"
  | "github_copilot"
  | "kiro"
  | "cursor"
  | "openai_compatible";

export interface OAuthPreset {
  profile?: OAuthProfile;
  displayName: string;
  clientId: string;
  /** OAuth confidential-client secret (public CLI values for Gemini/Antigravity/iFlow). */
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Separate refresh endpoint; fallback to tokenUrl when omitted. */
  refreshUrl?: string;
  scope: string;
  codeChallengeMethod: "S256";
  /** "json" sends token exchange as JSON; "form" as application/x-www-form-urlencoded. */
  tokenEncoding: "json" | "form";
  /** Refresh-specific encoding override (defaults to tokenEncoding). */
  refresh?: { encoding: "json" | "form" };
  providerType: OAuthProviderType;
  baseUrl: string;
  defaultModel: string;
  models?: string[];
  /** Extra headers required for upstream calls (e.g. CLI identity headers). */
  upstreamHeaders?: Record<string, string>;
  /** Extra params appended to the authorize URL. */
  extraAuthorizeParams?: Record<string, string>;
  /** Refresh lead time in ms (refresh if expiry within this window). */
  refreshLeadMs?: number;
  /** API-key preset: header name for key (e.g. "x-api-key"). */
  apiKeyHeader?: string;
  /** API-key preset: query param name for key (e.g. "api_key"). */
  apiKeyQuery?: string;
  /** API-key preset: prefix added before the key (e.g. "Bearer ", "sk-"). */
  apiKeyPrefix?: string;
  /** API-key preset: env var name for manual entry. */
  apiKeyEnv?: string;
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
  callbackPath?: string;
  fixedPort?: number;
  cursorClientVersion?: string;
  cursorClientType?: string;
  /** Kimchi: loopback delivers `?token=` (no authorization-code exchange). */
  tokenInCallback?: boolean;
  /** Kimchi web app base for `/cli-auth`. */
  kimchiWebAppUrl?: string;
  /** iFlow userInfo endpoint (returns API key after OAuth). */
  iflowUserInfoUrl?: string;
  /** Generic userInfo endpoint; falls back to provider-specific fields. */
  userInfoUrl?: string;
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
  /** Trae / ByteDance login guidance. */
  loginGuidanceUrl?: string;
  /** Device flow poll interval in ms (overrides server-suggested interval). */
  pollInterval?: number;
  /** Xiaomi MiMo: start login page URL. */
  mimoStartUrl?: string;
  /** Xiaomi MiMo: status check URL. */
  mimoStatusUrl?: string;
  /** Qoder / multi-region API bases. */
  openApiBaseUrl?: string;
  centerBaseUrl?: string;
  chatBaseUrl?: string;
  /** Quota / usage endpoint. */
  quotaUsageUrl?: string;
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
  },
  kimi: {
    profile: "kimi",
    displayName: "Kimi Code",
    clientId: "17e5f671-d194-4dfb-9706-5516cb48c098",
    clientSecret: "",
    authorizeUrl: "",
    tokenUrl: "https://auth.kimi.com/api/oauth/token",
    refreshUrl: "https://auth.kimi.com/api/oauth/token",
    deviceCodeUrl: "https://auth.kimi.com/api/oauth/device_authorization",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "form",
    deviceFlow: true,
    devicePkce: true,
    providerType: "openai_compatible",
    baseUrl: "https://api.kimi.com/coding/v1/messages",
    defaultModel: "kimi-k3",
    models: ["kimi-k3", "kimi-for-coding", "kimi-k2.7-code", "kimi-latest"],
    upstreamHeaders: {},
    refreshLeadMs: 5 * 60_000
  },
  qoder: {
    profile: "qoder",
    displayName: "Qoder",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "https://openapi.qoder.sh",
    deviceCodeUrl: "https://openapi.qoder.sh/api/v1/deviceToken/poll",
    refreshUrl: "https://center.qoder.sh/algo/api/v3/user/refresh_token",
    userInfoUrl: "https://openapi.qoder.sh/api/v1/userinfo",
    quotaUsageUrl: "https://openapi.qoder.sh/api/v2/quota/usage",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    deviceFlow: true,
    providerType: "openai_compatible",
    baseUrl: "https://api3.qoder.sh/algo/api/v2/service/pro/sse/agent_chat_generation",
    defaultModel: "qmodel_latest",
    models: ["qmodel_latest", "qmodel", "qfmodel", "kmodel_latest", "kmodel", "gmodel", "gfmodel", "dmodel", "dfmodel", "mmodel"],
    upstreamHeaders: {},
    refreshLeadMs: 10 * 60_000
  },
  qoder_cn: {
    profile: "qoder_cn",
    displayName: "Qoder CN",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "https://openapi.qoder.sh",
    deviceCodeUrl: "https://openapi.qoder.sh/api/v1/deviceToken/poll",
    refreshUrl: "https://center.qoder.sh/algo/api/v3/user/refresh_token",
    userInfoUrl: "https://openapi.qoder.sh/api/v1/userinfo",
    quotaUsageUrl: "https://openapi.qoder.sh/api/v2/quota/usage",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    deviceFlow: true,
    providerType: "openai_compatible",
    baseUrl: "https://api3.qoder.sh/algo/api/v2/service/pro/sse/agent_chat_generation",
    defaultModel: "qmodel_latest",
    models: ["qmodel_latest", "qmodel", "qfmodel", "kmodel_latest", "kmodel", "gmodel", "gfmodel", "dmodel", "dfmodel", "mmodel"],
    upstreamHeaders: {},
    refreshLeadMs: 10 * 60_000
  },
  codebuddy_intl: {
    profile: "codebuddy_intl",
    displayName: "CodeBuddy Intl",
    clientId: "codebuddy-intl",
    authorizeUrl: "https://copilot.tencent.com",
    tokenUrl: "https://copilot.tencent.com/v2/plugin/auth/token",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://copilot.tencent.com/v2",
    defaultModel: "glm-5.2",
    models: ["glm-5.2", "glm-5.1", "glm-5.0", "minimax-m3", "minimax-m2.7", "kimi-k2.7", "deepseek-v4-pro", "deepseek-v4-flash"],
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
  trae: {
    profile: "trae",
    displayName: "Trae (ByteDance)",
    clientId: "ono9krqynydwx5",
    clientSecret: "-",
    authorizeUrl: "",
    tokenUrl: "https://api.marscode.com/cloudide/api/v3/trae/oauth/ExchangeToken",
    refreshUrl: "https://api.marscode.com/cloudide/api/v3/trae/oauth/ExchangeToken",
    loginGuidanceUrl: "https://api.marscode.com/cloudide/api/v3/trae/GetLoginGuidance",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    refresh: { encoding: "json" },
    providerType: "openai_compatible",
    baseUrl: "https://core-normal.trae.ai/api/remote/v1",
    defaultModel: "gemini-3.1-pro",
    models: ["auto", "gemini-3.1-pro", "gemini-3-flash-solo", "minimax-m3", "minimax-m2.7", "kimi-k2.5", "gpt-5.4", "gpt-5.2"],
    upstreamHeaders: {
      "X-Trae-Client-Type": "web",
      "X-Preferenced-Language": "en",
      Referer: "https://solo.trae.ai/"
    },
    refreshLeadMs: 10 * 60_000
  },
  xiaomi_mimo: {
    profile: "xiaomi_mimo",
    displayName: "Xiaomi MiMo",
    clientId: "",
    authorizeUrl: "https://mimo.ai.xiaomi.com/api/login/web",
    tokenUrl: "https://mimo.ai.xiaomi.com/api/login/web",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://mimo.ai.xiaomi.com/v1",
    defaultModel: "mimo-vl",
    models: ["mimo-vl"],
    upstreamHeaders: {},
    refreshLeadMs: 60 * 60_000
  },
  clinepass: {
    profile: "clinepass",
    displayName: "ClinePass",
    clientId: "clinepass-extension",
    authorizeUrl: "https://api.cline.bot/api/v1/auth/authorize",
    tokenUrl: "https://api.cline.bot/api/v1/auth/token",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    skipPkce: true,
    providerType: "openai_compatible",
    baseUrl: "https://api.cline.bot/api/v1",
    defaultModel: "anthropic/claude-sonnet-4.6",
    models: ["anthropic/claude-sonnet-4.6", "openai/gpt-5.4", "google/gemini-3.1-pro-preview"],
    upstreamHeaders: {
      "HTTP-Referer": "https://cline.bot",
      "X-Title": "ClinePass",
      "X-CLIENT-TYPE": "nesarouter"
    },
    fixedRedirectUri: "http://127.0.0.1:51890/callback",
    loopbackPort: 51890,
    loopbackPath: "/callback",
    refreshLeadMs: 10 * 60_000
  },
  gitlab: {
    profile: "gitlab",
    displayName: "GitLab Duo",
    clientId: "",
    authorizeUrl: "https://gitlab.com/oauth/authorize",
    tokenUrl: "https://gitlab.com/oauth/token",
    scope: "api read_api read_repository",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://gitlab.com/api/v4",
    defaultModel: "gitlab-duo",
    models: ["gitlab-duo"],
    upstreamHeaders: {},
    refreshLeadMs: 10 * 60_000
  },
  windsurf: {
    profile: "windsurf",
    displayName: "Windsurf",
    clientId: "",
    authorizeUrl: "https://windsurf.com/oauth/authorize",
    tokenUrl: "https://windsurf.com/oauth/token",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://windsurf.com/api/v1",
    defaultModel: "windsurf-default",
    models: ["windsurf-default"],
    upstreamHeaders: {},
    refreshLeadMs: 10 * 60_000
  },
  zed: {
    profile: "zed",
    displayName: "Zed",
    clientId: "",
    authorizeUrl: "https://zed.ai/oauth/authorize",
    tokenUrl: "https://zed.ai/oauth/token",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://zed.ai/api/v1",
    defaultModel: "zed-default",
    models: ["zed-default"],
    upstreamHeaders: {},
    refreshLeadMs: 10 * 60_000
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

/**
 * Non-OAuth API-key presets (free / free-tier / paid).
 */
export const API_PRESETS: Record<string, OAuthPreset> = {
  together: {
    profile: undefined,
    displayName: "Together AI",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    models: [
      "meta-llama/Llama-3.1-8B-Instruct-Turbo",
      "meta-llama/Llama-3.1-70B-Instruct-Turbo",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "Qwen/Qwen2.5-72B-Instruct-Turbo"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  groq: {
    profile: undefined,
    displayName: "Groq",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-8b-instant",
    models: [
      "llama-3.1-8b-instant",
      "llama-3.1-70b-versatile",
      "mixtral-8x7b-32768",
      "gemma2-9b-it"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  fireworks: {
    profile: undefined,
    displayName: "Fireworks AI",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p1-8b-instruct",
    models: [
      "accounts/fireworks/models/llama-v3p1-8b-instruct",
      "accounts/fireworks/models/llama-v3p1-70b-instruct",
      "accounts/fireworks/models/mixtral-8x7b-instruct",
      "accounts/fireworks/models/qwen2-72b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  perplexity: {
    profile: undefined,
    displayName: "Perplexity",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "llama-3.1-sonar-large-128k-online",
    models: [
      "llama-3.1-sonar-large-128k-online",
      "llama-3.1-sonar-small-128k-online",
      "llama-3.1-sonar-huge-128k-online"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  cohere: {
    profile: undefined,
    displayName: "Cohere",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.cohere.ai/v2",
    defaultModel: "command-r-plus",
    models: [
      "command-r-plus",
      "command-r",
      "command",
      "command-light"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  mistral: {
    profile: undefined,
    displayName: "Mistral",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    models: [
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "open-mistral-nemo",
      "open-mixtral-8x22b",
      "codestral-latest"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  huggingface: {
    profile: undefined,
    displayName: "Hugging Face",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api-inference.huggingface.co/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    models: [
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "Qwen/Qwen2.5-72B-Instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  openrouter: {
    profile: undefined,
    displayName: "OpenRouter",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.1-8b-instruct:free",
    models: [
      "meta-llama/llama-3.1-8b-instruct:free",
      "meta-llama/llama-3.1-70b-instruct",
      "google/gemini-pro-1.5",
      "anthropic/claude-3.5-sonnet"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  deepseek: {
    profile: undefined,
    displayName: "DeepSeek",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: [
      "deepseek-chat",
      "deepseek-coder"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  zhipu: {
    profile: undefined,
    displayName: "Zhipu AI (GLM)",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
    models: [
      "glm-4-plus",
      "glm-4",
      "glm-4-flash",
      "glm-4v-plus"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  moonshot: {
    profile: undefined,
    displayName: "Moonshot",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    models: [
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  cerebras: {
    profile: undefined,
    displayName: "Cerebras",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama3.1-8b",
    models: [
      "llama3.1-8b",
      "llama3.1-70b",
      "mixtral-8x7b-instruct-v0.1"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  fal: {
    profile: undefined,
    displayName: "Fal.ai",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://fal.run/api/v1",
    defaultModel: "fal-ai/llama-v3p1-8b",
    models: [
      "fal-ai/llama-v3p1-8b",
      "fal-ai/llama-v3p1-70b",
      "fal-ai/mixtral-8x7b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  replicate: {
    profile: undefined,
    displayName: "Replicate",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.replicate.com/v1",
    defaultModel: "meta/llama-3.1-8b-instruct",
    models: [
      "meta/llama-3.1-8b-instruct",
      "meta/llama-3.1-70b-instruct",
      "mistralai/mixtral-8x7b-instruct-v0.1"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  runware: {
    profile: undefined,
    displayName: "Runware",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.runware.ai/v1",
    defaultModel: "runware/llama-v3p1-8b-instruct",
    models: [
      "runware/llama-v3p1-8b-instruct",
      "runware/llama-v3p1-70b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  chutes: {
    profile: undefined,
    displayName: "Chutes",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.chutes.ai/v1",
    defaultModel: "chutes/llama-v3p1-8b-instruct",
    models: [
      "chutes/llama-v3p1-8b-instruct",
      "chutes/llama-v3p1-70b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  hyperbolic: {
    profile: undefined,
    displayName: "Hyperbolic",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.hyperbolic.xyz/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    models: [
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
      "mistralai/Mixtral-8x7B-Instruct-v0.1"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  nebius: {
    profile: undefined,
    displayName: "Nebius AI Studio",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.studio.nebius.com/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    models: [
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
      "mistralai/Mixtral-8x7B-Instruct-v0.1"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  sarvam: {
    profile: undefined,
    displayName: "Sarvam",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.sarvam.ai/v1",
    defaultModel: "sarvam/llama-v3p1-8b-instruct",
    models: [
      "sarvam/llama-v3p1-8b-instruct",
      "sarvam/llama-v3p1-70b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  scaleway: {
    profile: undefined,
    displayName: "Scaleway",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.scaleway.ai/v1",
    defaultModel: "llama-3.1-8b-instruct",
    models: [
      "llama-3.1-8b-instruct",
      "llama-3.1-70b-instruct",
      "mixtral-8x7b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  morph: {
    profile: undefined,
    displayName: "Morph",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.morphllm.com/v1",
    defaultModel: "morph/llama-v3p1-8b-instruct",
    models: [
      "morph/llama-v3p1-8b-instruct",
      "morph/llama-v3p1-70b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  blackbox: {
    profile: undefined,
    displayName: "Blackbox AI",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.blackbox.ai/v1",
    defaultModel: "blackbox/llama-v3p1-8b-instruct",
    models: [
      "blackbox/llama-v3p1-8b-instruct",
      "blackbox/llama-v3p1-70b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  nanogpt: {
    profile: undefined,
    displayName: "NanoGPT",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.nanogpt.com/v1",
    defaultModel: "gpt-4o-mini",
    models: [
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-3.5-turbo"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  gmicloud: {
    profile: undefined,
    displayName: "GMI Cloud",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.gmicloud.ai/v1",
    defaultModel: "gmi/llama-v3p1-8b-instruct",
    models: [
      "gmi/llama-v3p1-8b-instruct",
      "gmi/llama-v3p1-70b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  felo: {
    profile: undefined,
    displayName: "Felo",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.felo.ai/v1",
    defaultModel: "felo/llama-v3p1-8b-instruct",
    models: [
      "felo/llama-v3p1-8b-instruct",
      "felo/llama-v3p1-70b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  zenmux: {
    profile: undefined,
    displayName: "Zenmux",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.zenmux.ai/v1",
    defaultModel: "zenmux/llama-v3p1-8b-instruct",
    models: [
      "zenmux/llama-v3p1-8b-instruct",
      "zenmux/llama-v3p1-70b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  },
  agentrouter: {
    profile: undefined,
    displayName: "AgentRouter",
    clientId: "",
    authorizeUrl: "",
    tokenUrl: "",
    scope: "",
    codeChallengeMethod: "S256",
    tokenEncoding: "json",
    providerType: "openai_compatible",
    baseUrl: "https://api.agentrouter.ai/v1",
    defaultModel: "agentrouter/llama-v3p1-8b-instruct",
    models: [
      "agentrouter/llama-v3p1-8b-instruct",
      "agentrouter/llama-v3p1-70b-instruct"
    ],
    apiKeyHeader: "Authorization",
    apiKeyQuery: undefined,
    apiKeyPrefix: "Bearer "
  }
};
