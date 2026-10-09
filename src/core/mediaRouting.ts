import { providerHasCredential } from "@/core/providerCredentials";
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
  return providerHasCredential(provider);
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
 * The chat router may rank a provider the media passthrough cannot call (Gemini,
 * OAuth chat adapters, …), so auto mode keeps walking the routing order until it
 * finds an OpenAI-compatible provider instead of failing the request outright.
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

  const body = {
    model: options.model,
    messages: [{ role: "user", content: options.probeText }]
  };
  const incompatible: string[] = [];
  let lastRoutingError: unknown;
  while (incompatible.length < store.providers.length) {
    let decision: RouteDecision;
    try {
      decision = chooseProvider(store, body, incompatible);
    } catch (error) {
      lastRoutingError = error;
      break;
    }
    if (decision.provider.type === "openai_compatible") return decision;
    incompatible.push(decision.provider.id);
  }

  if (incompatible.length) {
    throw new Error(
      `${kind} need an OpenAI-compatible provider. Skipped ${incompatible.length} provider(s) without the OpenAI API adapter (${incompatible.join(", ")}).`
    );
  }
  throw lastRoutingError instanceof Error
    ? lastRoutingError
    : new Error(`No provider is available for ${kind} requests.`);
}
