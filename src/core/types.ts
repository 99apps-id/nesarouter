import type { SaverLevel, TokenSaverSettings } from "@/core/tokenSaver";
import type { ModelAlias } from "@/core/aliases";

export type ProviderTier = "free" | "cheap" | "balanced" | "premium";

export type RoutingMode = "auto" | "free_first" | "cheapest" | "best" | "manual";
export type ProviderStrategy = "priority" | "round_robin";
export type FallbackMode = "auto" | "off";

export type ProviderStatus = "active" | "disabled" | "cooldown";

export type ProviderConnectionStatus = "unknown" | "connected" | "error";

export type CostSource = "provider_usage" | "estimated" | "cached" | "free";

export type TaskType = "chat" | "coding_light" | "coding_heavy" | "analysis";

export interface OAuthAccount {
  id: string;
  name?: string;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthTokenExpiresAt?: string;
  oauthLastRefreshAt?: string;
  oauthCopilotToken?: string;
  oauthCopilotTokenExpiresAt?: string;
  oauthProjectId?: string;
  oauthDeviceClientId?: string;
  oauthDeviceClientSecret?: string;
  oauthMachineId?: string;
  connectionStatus?: ProviderConnectionStatus;
  lastError?: string;
  lastCheckedAt?: string;
  rateLimitedUntil?: string;
  createdAt?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: "openai_compatible" | "gemini" | "gemini_cli" | "anthropic_messages" | "openai_responses" | "github_copilot" | "kiro" | "opencode" | "cursor";
  tier: ProviderTier;
  status: ProviderStatus;
  baseUrl: string;
  apiKey: string;
  /** Additional API keys for multi-account round-robin. */
  apiKeys?: string[];
  model: string;
  /** All models this provider can serve (model is the primary/first entry). */
  models?: string[];
  priority: number;
  inputCostPerMTok: number;
  outputCostPerMTok: number;
  rateLimitedUntil?: string;
  lastError?: string;
  connectionStatus?: ProviderConnectionStatus;
  lastCheckedAt?: string;
  /** Daily token quota cap per provider (0/undefined = unlimited). */
  quotaLimitTokens?: number;
  /** Outbound proxy URL applied to this provider's upstream calls (http/https/socks). */
  proxyUrl?: string;
  /** OAuth subscription auth (e.g. Claude/ChatGPT/Gemini CLI/GitHub Copilot/Kiro/Antigravity/Cursor). */
  oauthProfile?: "anthropic_claude" | "openai_codex" | "gemini_cli" | "github_copilot" | "kiro" | "antigravity" | "cursor";
  /** Multiple OAuth accounts per provider (round-robin + per-account cooldown). */
  oauthAccounts?: OAuthAccount[];
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthTokenExpiresAt?: string;
  oauthLastRefreshAt?: string;
  /** GitHub Copilot short-lived session token (derived from the GitHub access token). */
  oauthCopilotToken?: string;
  oauthCopilotTokenExpiresAt?: string;
  /** Antigravity / Gemini CLI Cloud Code project id from loadCodeAssist. */
  oauthProjectId?: string;
  /** Kiro AWS OIDC registered client (Builder ID device flow). */
  oauthDeviceClientId?: string;
  oauthDeviceClientSecret?: string;
  /** Cursor IDE machine id from state.vscdb (checksum). */
  oauthMachineId?: string;
}

export interface Combo {
  id: string;
  name: string;
  /** Ordered provider ids that form the combo chain. */
  providerIds: string[];
  strategy: "fallback" | "round_robin";
}

export interface McpServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface BudgetSettings {
  dailyBudgetUsd: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  hardLimitPercent: number;
  onWarning: "prefer_cheaper" | "notify_only";
  onCritical: "free_tier_only" | "prefer_cheaper";
  onExceeded: "block_paid" | "allow_with_warning";
}

export interface MediaRoutingSettings {
  /** Empty = use routing engine (auto). */
  imagesProviderId?: string;
  speechProviderId?: string;
  transcriptionsProviderId?: string;
  embeddingsProviderId?: string;
  /** Built-in DuckDuckGo search is always used today; reserved for future provider override. */
  searchMode?: "builtin";
}

export interface RouterSettings {
  routingMode: RoutingMode;
  providerStrategy?: ProviderStrategy;
  fallbackMode?: FallbackMode;
  evaluatorEnabled?: boolean;
  preferFreeTier: boolean;
  cacheEnabled: boolean;
  manualProviderId?: string;
  mediaRouting?: MediaRoutingSettings;
  rtkEnabled?: boolean;
  tokenSaver?: TokenSaverSettings;
  /** When true, chat pipeline POSTs messages to Headroom `/v1/compress` before cache/upstream. Fail-open. */
  headroomEnabled?: boolean;
  headroomUrl?: string;
  headroomCompressUserMessages?: boolean;
  /** Optional in-process pxpipe-style compression (fail-open). */
  pxpipeEnabled?: boolean;
  /**
   * Public origin for OAuth return URLs and CLI hints (e.g. https://router.example.com).
   * Prefer this (or NESA_PUBLIC_URL) when NesaRouter sits behind a reverse proxy.
   */
  publicBaseUrl?: string;
  /** Saved CLI wizard preferences per tool id. */
  cliTools?: Record<string, { modelTarget?: string }>;
  /**
   * Max concurrent upstream provider calls process-wide. 0 = unlimited (default).
   */
  maxConcurrentUpstream?: number;
  /**
   * Max concurrent upstream calls per provider id. 0 = unlimited (default).
   */
  maxConcurrentPerProvider?: number;
  /** How long to wait for a concurrency slot before failing with 503. */
  queueWaitMs?: number;
}

export interface UsageLog {
  id: string;
  createdAt: string;
  providerId: string;
  providerName: string;
  model: string;
  tier: ProviderTier;
  taskType: TaskType;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  costSource: CostSource;
  cacheStatus: "hit" | "miss" | "skipped";
  budgetStatus: "ok" | "warning" | "critical" | "exceeded";
  routingReason: string;
  status: "success" | "error";
  error?: string;
  skippedProviders?: Array<{ providerId: string; reason: string }>;
}

export interface CacheEntry {
  key: string;
  createdAt: string;
  providerId: string;
  model: string;
  response: unknown;
  inputTokens: number;
  outputTokens: number;
  savedCostUsd: number;
}

export interface NesaStore {
  providers: ProviderConfig[];
  budget: BudgetSettings;
  router: RouterSettings;
  usage: UsageLog[];
  cache: CacheEntry[];
  localApiKeys: string[];
  combos: Combo[];
  aliases?: ModelAlias[];
}

export interface RouteDecision {
  provider: ProviderConfig;
  taskType: TaskType;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  budgetStatus: UsageLog["budgetStatus"];
  routingReason: string;
  skippedProviders: Array<{ providerId: string; reason: string }>;
}
