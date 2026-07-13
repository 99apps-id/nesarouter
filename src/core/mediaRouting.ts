import { getBudgetStatus } from "@/core/budget";
import { chooseProvider } from "@/core/router";
import { MediaKind } from "@/core/mediaPassthrough";
import { NesaStore, ProviderConfig, RouteDecision } from "@/core/types";

function mediaProviderId(store: NesaStore, kind: MediaKind): string | undefined {
  const routing = store.router.mediaRouting;
  if (!routing) return undefined;
  switch (kind) {
    case "images":
      return routing.imagesProviderId?.trim() || undefined;
    case "speech":
      return routing.speechProviderId?.trim() || undefined;
    case "transcriptions":
      return routing.transcriptionsProviderId?.trim() || undefined;
    case "embeddings":
      return routing.embeddingsProviderId?.trim() || undefined;
  }
}

function isProviderReady(provider: ProviderConfig) {
  if (provider.status !== "active") return false;
  if (provider.apiKey || provider.oauthAccessToken) return true;
  return Array.isArray(provider.apiKeys) && provider.apiKeys.some((key) => typeof key === "string" && key.trim());
}

function manualMediaDecision(store: NesaStore, provider: ProviderConfig, probeText: string, kind: MediaKind): RouteDecision {
  const estimatedInputTokens = Math.max(1, Math.ceil(probeText.length / 4));
  const estimatedOutputTokens = kind === "embeddings" ? 0 : 256;
  const estimatedCostUsd = 0;
  return {
    provider,
    taskType: kind === "embeddings" ? "analysis" : "chat",
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUsd,
    budgetStatus: getBudgetStatus(store, estimatedCostUsd),
    skippedProviders: [],
    routingReason: `Media routing pinned to ${provider.name}.`
  };
}

/**
 * Resolve provider for OpenAI-compatible media endpoints.
 * Uses per-kind overrides from Routing → Media when set; otherwise falls back to the chat router.
 */
export function chooseMediaProvider(
  store: NesaStore,
  kind: MediaKind,
  options: { model: string; probeText: string }
): RouteDecision {
  const pinnedId = mediaProviderId(store, kind);
  if (pinnedId) {
    const provider = store.providers.find((item) => item.id === pinnedId);
    if (!provider) throw new Error(`Media provider '${pinnedId}' is not configured.`);
    if (!isProviderReady(provider)) throw new Error(`Media provider '${provider.name}' is not active or has no credentials.`);
    if (provider.type !== "openai_compatible") {
      throw new Error(`Media provider '${provider.name}' must use the OpenAI API adapter.`);
    }
    return manualMediaDecision(store, provider, options.probeText, kind);
  }

  return chooseProvider(store, {
    model: options.model,
    messages: [{ role: "user", content: options.probeText }]
  });
}
