import { ProviderConfig } from "@/core/types";
import { getPreset } from "@/core/oauthProviderPresets";
import { loadProviderWithFreshToken } from "@/core/providerOAuthFlow";
import {
  isChatgptCodexUpstream,
  normalizeCodexResponsesRequest,
  openAiChatToResponsesRequest,
  responsesResponseToOpenAi,
  responsesSseToOpenAiSse
} from "@/core/translatorReverse";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

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

/** Extract ChatGPT workspace id from Codex access/id JWT claims. */
export function extractChatgptAccountId(token: string): string | undefined {
  const parts = token.split(".");
  if (parts.length < 2) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      "https://api.openai.com/auth"?: { chatgpt_account_id?: string };
    };
    const id = payload?.["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof id === "string" && id.trim() ? id.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function collectSseChatCompletion(stream: ReadableStream<Uint8Array>, model: string) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let finishReason: string | null = "stop";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      idx = buffer.indexOf("\n\n");
      const dataLine = raw.split(/\r?\n/).find((l) => l.startsWith("data:"))?.slice(5).trim();
      if (!dataLine || dataLine === "[DONE]") continue;
      let parsed: any;
      try {
        parsed = JSON.parse(dataLine);
      } catch {
        continue;
      }
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === "string") content += delta;
      if (parsed?.choices?.[0]?.finish_reason) finishReason = parsed.choices[0].finish_reason;
      if (parsed?.usage) {
        usage = {
          prompt_tokens: parsed.usage.prompt_tokens ?? usage.prompt_tokens,
          completion_tokens: parsed.usage.completion_tokens ?? usage.completion_tokens,
          total_tokens: parsed.usage.total_tokens ?? usage.total_tokens
        };
      }
    }
  }

  return {
    id: `chatcmpl-codex-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finishReason }],
    usage
  };
}

export class OpenAiResponsesExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? provider.apiKey ?? "");
    const preset = getPreset(provider.oauthProfile);
    // Prefer URL+id detection so a mistyped type/profile still gets store:false.
    const isCodex = isChatgptCodexUpstream(provider) || preset?.profile === "openai_codex";
    const accountId = isCodex ? extractChatgptAccountId(token) : undefined;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(preset?.upstreamHeaders ?? {}),
      ...(accountId ? { "ChatGPT-Account-ID": accountId } : {}),
      ...(isCodex
        ? {
            accept: "text/event-stream",
            "OpenAI-Beta": "responses=experimental",
            session_id: crypto.randomUUID()
          }
        : {})
    };

    // Prefer Responses-shaped bodies from clients that already sent `input`
    // (avoids dropping structured items), then pin Codex constraints.
    const responsesShaped =
      Array.isArray(body?.input) || typeof body?.input === "string"
        ? { ...body, model: provider.model }
        : openAiChatToResponsesRequest({ ...body, model: provider.model }, { codex: isCodex });
    const clientWantsStream = Boolean(body?.stream);
    const upstreamStream = clientWantsStream || isCodex;
    const streamed =
      upstreamStream && !responsesShaped.stream ? { ...responsesShaped, stream: true } : responsesShaped;
    const finalRequest = isCodex
      ? normalizeCodexResponsesRequest(streamed as Record<string, unknown>)
      : (streamed as Record<string, unknown>);
    // Belt-and-suspenders: never POST store!=false to ChatGPT Codex.
    if (isCodex) finalRequest.store = false;

    const response = await proxyFetch(provider, baseUrl(provider), {
      method: "POST",
      headers,
      body: JSON.stringify(finalRequest)
    });

    if (!response.ok) throw await upstreamError(provider, response);
    if (upstreamStream) {
      if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
      const sse = responsesSseToOpenAiSse(response.body, provider.model);
      if (clientWantsStream) return sse;
      // Codex backend is SSE-only; buffer for non-stream clients + /compact.
      return collectSseChatCompletion(sse, provider.model);
    }
    const payload = await response.json();
    return responsesResponseToOpenAi(payload, provider.model);
  }

  async listModels(provider: ProviderConfig): Promise<string[]> {
    const preset = getPreset(provider.oauthProfile);
    if (!isChatgptCodexUpstream(provider) && preset?.profile !== "openai_codex") {
      if (provider.models?.length) return [...provider.models];
      return provider.model ? [provider.model] : [];
    }
    const fallback = codexModelFallback(provider);

    const refreshed = await loadProviderWithFreshToken(provider.id);
    const token = refreshed?.oauthAccessToken ?? provider.oauthAccessToken;
    if (!token) return fallback;

    const accountId = extractChatgptAccountId(token);
    const response = await proxyFetch(provider, CODEX_MODELS_URL, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(preset?.upstreamHeaders ?? {}),
        ...(accountId ? { "ChatGPT-Account-ID": accountId } : {})
      }
    });

    if (!response.ok) return fallback;
    const payload = await response.json().catch(() => null);
    const live = appendCodexReviewModels(parseCodexModelIds(payload));
    return live.length ? live : fallback;
  }

  async validate(provider: ProviderConfig) {
    const token = cleanApiKey(provider.oauthAccessToken || provider.apiKey || "");
    if (!token) throw new UpstreamProviderError(`${provider.name} needs an OAuth token or API key.`, 400);
    const models = await this.listModels(provider);
    return {
      models,
      message: getPreset(provider.oauthProfile)?.profile === "openai_codex"
        ? `Codex OAuth accepted${models.length ? ` · ${models.length} models` : ""}.`
        : `OpenAI Responses credential accepted${models.length ? ` · ${models.length} models` : ""}.`
    };
  }
}
