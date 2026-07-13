import { ProviderConfig } from "@/core/types";

/**
 * Short provider prefixes for `prefix/model` routing (9router-style).
 * Full provider ids also work: `oauth-chatgpt/gpt-5.5`.
 */
export const PROVIDER_PREFIXES: Record<string, string> = {
  // OAuth / subscription
  cx: "oauth-chatgpt",
  chatgpt: "oauth-chatgpt",
  codex: "oauth-codex",
  cc: "oauth-claude",
  claude: "oauth-claude",
  gemini: "oauth-gemini-cli",
  gcli: "oauth-gemini-cli",
  antigravity: "oauth-antigravity",
  ag: "oauth-antigravity",
  copilot: "oauth-github-copilot",
  ghcp: "oauth-github-copilot",
  kiro: "oauth-kiro",
  cursor: "oauth-cursor",
  cur: "oauth-cursor",

  // Common API-key presets
  or: "openrouter-free",
  openrouter: "openrouter-free",
  orp: "openrouter-paid",
  ollama: "ollama-local",
  ds: "deepseek",
  deepseek: "deepseek",
  groq: "groq",
  mistral: "mistral",
  xai: "xai-grok",
  grok: "xai-grok",
  geminiapi: "gemini-flash",
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
 * Parse `cx/gpt-5.5` or `oauth-chatgpt/gpt-5.5`.
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
