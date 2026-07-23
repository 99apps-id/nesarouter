import { ProviderConfig } from "@/core/types";

/**
 * Short provider prefixes for `prefix/model` routing (9router-style).
 * Codex subscription uses `cx/gpt-…` only (canonical provider id: oauth-chatgpt).
 */
export const PROVIDER_PREFIXES: Record<string, string> = {
  // OAuth / subscription
  cx: "oauth-chatgpt",
  codex: "oauth-chatgpt",
  cc: "oauth-claude",
  claude: "oauth-claude",
  gemini: "oauth-gemini-cli",
  gemicli: "oauth-gemini-cli",
  antigravity: "oauth-antigravity",
  ag: "oauth-antigravity",
  copilot: "oauth-github-copilot",
  ghcp: "oauth-github-copilot",
  kiro: "oauth-kiro",
  cursor: "oauth-cursor",
  cur: "oauth-cursor",
  qw: "oauth-qwen-code",
  qwen: "oauth-qwen-code",
  gcli: "oauth-grok-cli",
  grokcli: "oauth-grok-cli",
  gb: "oauth-grok-cli",
  kimchi: "oauth-kimchi",
  iflow: "oauth-iflow",
  cbcn: "oauth-codebuddy-cn",
  codebuddy: "oauth-codebuddy-cn",
  clineo: "oauth-cline",
  kc: "oauth-kilocode",
  kilooauth: "oauth-kilocode",

  // Common API-key presets
  nr: "nesarouter",
  nesa: "nesarouter",
  or: "openrouter-free",
  openrouter: "openrouter-free",
  orp: "openrouter-paid",
  ollama: "ollama-local",
  oc: "opencode-free",
  opencode: "opencode-free",
  ocgo: "opencode-go",
  "opencode-go": "opencode-go",
  ds: "deepseek",
  deepseek: "deepseek",
  groq: "groq",
  mistral: "mistral",
  xai: "xai-grok",
  grok: "xai-grok",
  geminiapi: "gemini-flash",
  mimo: "xiaomi-mimo",
  xiaomi: "xiaomi-mimo",
  mimofree: "mimo-code-free",
  xmtp: "xiaomi-tokenplan",
  dscope: "alibaba-dashscope",
  dashscope: "alibaba-dashscope",
  dscopeintl: "alibaba-dashscope-intl",
  alibaba: "alibaba-dashscope",
  alicode: "alibaba-coding",
  rw: "runware",
  runware: "runware",
  cf: "cloudflare-workers-ai",
  cloudflare: "cloudflare-workers-ai",
  workersai: "cloudflare-workers-ai",
  vertex: "vertex-ai",
  vx: "vertex-ai",
  vxp: "vertex-partner",
  vxc: "vertex-claude",
  gw: "grok-web",
  grokweb: "grok-web",
  azure: "azure-openai",
  az: "azure-openai",
  blackbox: "blackbox",
  bb: "blackbox",
  kilo: "kilocode",
  cline: "cline",
  clinepass: "clinepass",
  tencent: "codebuddy-cn",
  gitlab: "gitlab-duo",
  duo: "gitlab-duo",
  minimaxcn: "minimax-cn",
  pa: "perplexity-agent",
  pplxagent: "perplexity-agent",
  oa: "openai-compatible",
  openai: "openai-compatible",
  anthropic: "anthropic-messages"
};

export interface PrefixedModel {
  prefix: string;
  providerId: string;
  modelId: string;
}

export function listPrefixesForProvider(providerId: string): string[] {
  const id = providerId.toLowerCase();
  const shorts = Object.entries(PROVIDER_PREFIXES)
    .filter(([, target]) => target.toLowerCase() === id)
    .map(([prefix]) => prefix);
  return [...new Set([id, ...shorts])];
}

export function resolvePrefixToProviderId(prefix: string, providers: ProviderConfig[]): string | undefined {
  const normalized = prefix.trim().toLowerCase();
  if (!normalized) return undefined;

  const mapped = PROVIDER_PREFIXES[normalized];
  if (mapped && providers.some((provider) => provider.id === mapped)) return mapped;

  const exact = providers.find((provider) => provider.id.toLowerCase() === normalized);
  if (exact) return exact.id;

  return mapped;
}

function providerOwnsExactModel(provider: ProviderConfig, model: string) {
  const normalized = model.toLowerCase();
  if (provider.model.toLowerCase() === normalized) return true;
  if (Array.isArray(provider.models) && provider.models.some((item) => item.toLowerCase() === normalized)) return true;
  return false;
}

/** True when the full string is already a concrete model id (e.g. openrouter/free). */
export function isExactConfiguredModel(providers: ProviderConfig[], model: string) {
  return providers.some((provider) => providerOwnsExactModel(provider, model));
}

/**
 * Parse `cx/gpt-5.6-sol` (Codex) or full provider id when configured.
 * Does not claim slash-containing model ids that are already configured on a provider.
 */
export function parsePrefixedModel(model: string, providers: ProviderConfig[]): PrefixedModel | null {
  const trimmed = model.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) return null;
  if (isExactConfiguredModel(providers, trimmed)) return null;

  const prefix = trimmed.slice(0, slash);
  const modelId = trimmed.slice(slash + 1).trim();
  if (!modelId) return null;

  const providerId = resolvePrefixToProviderId(prefix, providers);
  if (!providerId) return null;

  return { prefix: prefix.toLowerCase(), providerId, modelId };
}
