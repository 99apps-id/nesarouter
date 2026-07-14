import { ProviderConfig } from "@/core/types";
import { getPreset } from "@/core/oauthProviderPresets";
import { loadProviderWithFreshToken } from "@/core/providerOAuthFlow";
import {
  normalizeCodexResponsesRequest,
  openAiChatToResponsesRequest,
  responsesResponseToOpenAi,
  responsesSseToOpenAiSse
} from "@/core/translatorReverse";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, upstreamError } from "@/core/providers/shared";

const CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models?client_version=1.0.0";

function parseCodexModelIds(data: unknown): string[] {
  const list = (data as { data?: Array<{ id?: string }> })?.data;
  if (!Array.isArray(list)) return [];
  return list.map((item) => item?.id).filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** Codex exposes separate review quota models as `*-review` aliases. */
export function appendCodexReviewModels(ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    out.add(id);
    if (!id.endsWith("-review")) out.add(`${id}-review`);
  }
  return [...out];
}

function codexModelFallback(provider: ProviderConfig): string[] {
  const preset = getPreset(provider.oauthProfile);
  if (preset?.models?.length) return [...preset.models];
  return preset?.defaultModel ? [preset.defaultModel] : [];
}

export class OpenAiResponsesExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? "");
    const preset = getPreset(provider.oauthProfile);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(preset?.upstreamHeaders ?? {})
    };

    const isCodex = preset?.profile === "openai_codex";
    const request = openAiChatToResponsesRequest({ ...body, model: provider.model }, { codex: isCodex });
    const wantStream = Boolean(body?.stream) || isCodex;
    const streamed = wantStream && !request.stream ? { ...request, stream: true } : request;
    const finalRequest = isCodex ? normalizeCodexResponsesRequest(streamed) : streamed;

    const response = await proxyFetch(provider, baseUrl(provider), {
      method: "POST",
      headers,
      body: JSON.stringify(finalRequest)
    });

    if (!response.ok) throw await upstreamError(provider, response);
    // Codex subscription path is SSE-only.
    if (wantStream || isCodex) {
      if (!response.body) throw new Error(`${provider.name} returned no stream body.`);
      return responsesSseToOpenAiSse(response.body, provider.model);
    }
    const payload = await response.json();
    return responsesResponseToOpenAi(payload, provider.model);
  }

  async listModels(provider: ProviderConfig): Promise<string[]> {
    const preset = getPreset(provider.oauthProfile);
    const fallback = codexModelFallback(provider);
    if (preset?.profile !== "openai_codex") return fallback;

    const refreshed = await loadProviderWithFreshToken(provider.id);
    const token = refreshed?.oauthAccessToken ?? provider.oauthAccessToken;
    if (!token) return fallback;

    const response = await proxyFetch(provider, CODEX_MODELS_URL, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(preset.upstreamHeaders ?? {})
      }
    });

    if (!response.ok) return fallback;
    const payload = await response.json().catch(() => null);
    const live = appendCodexReviewModels(parseCodexModelIds(payload));
    return live.length ? live : fallback;
  }
}
