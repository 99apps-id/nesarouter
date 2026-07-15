import { ProviderConfig } from "@/core/types";
import { fromGeminiResponse, toGeminiRequest } from "@/core/providers/gemini";
import { geminiStreamToOpenAiSse } from "@/core/streaming";
import {
  claudeResponseToOpenAi,
  claudeSseToOpenAiSse,
  openAiChatToClaudeRequest,
  openAiChatToResponsesRequest,
  responsesResponseToOpenAi,
  responsesSseToOpenAiSse
} from "@/core/translatorReverse";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, sortModelIds, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

const FREE_MODELS = [
  "big-pickle",
  "deepseek-v4-flash-free",
  "mimo-v2.5-free",
  "north-mini-code-free",
  "nemotron-3-ultra-free"
] as const;

const DEFAULT_FREE_MODEL = "big-pickle";

type ZenSurface = "chat" | "messages" | "responses" | "gemini";

export function resolveOpenCodeModel(model: string | undefined): string {
  const id = (model ?? "").trim();
  if (!id || id === "auto") return DEFAULT_FREE_MODEL;
  return id;
}

export function isOpenCodeGo(provider: ProviderConfig): boolean {
  return provider.id === "opencode-go" || /\/zen\/go(\/|$)/i.test(provider.baseUrl);
}

export function zenSurfaceForModel(model: string, provider?: ProviderConfig): ZenSurface {
  const id = model.toLowerCase();
  if (id.startsWith("gpt-") || id.includes("codex")) return "responses";
  if (id.startsWith("claude-") || id.startsWith("qwen")) return "messages";
  if (provider && isOpenCodeGo(provider) && id.startsWith("minimax")) return "messages";
  if (id.startsWith("gemini-")) return "gemini";
  return "chat";
}

/** Root for Zen APIs: `…/zen/v1` or `…/zen/go/v1`. */
export function zenApiRoot(provider: ProviderConfig): string {
  const root = baseUrl(provider).replace(/\/$/, "");
  if (/\/zen\/go\/v1$/i.test(root) || /\/zen\/v1$/i.test(root)) return root;
  if (isOpenCodeGo(provider)) {
    if (/\/zen\/go/i.test(root)) return root.replace(/\/zen\/go.*$/i, "/zen/go/v1");
    return `${root}/zen/go/v1`;
  }
  if (/\/zen\//i.test(root)) return root.replace(/\/zen\/.*$/i, "/zen/v1");
  return `${root}/zen/v1`;
}

function zenUrl(provider: ProviderConfig, model: string, surface: ZenSurface, stream: boolean): string {
  const root = zenApiRoot(provider);
  if (surface === "messages") return `${root}/messages`;
  if (surface === "responses") return `${root}/responses`;
  if (surface === "gemini") {
    const path = `${root}/models/${encodeURIComponent(model)}`;
    return stream ? `${path}:streamGenerateContent?alt=sse` : `${path}:generateContent`;
  }
  return `${root}/chat/completions`;
}

function modelsUrl(provider: ProviderConfig) {
  return `${zenApiRoot(provider)}/models`;
}

function opencodeHeaders(apiKey: string | undefined, stream = true): Record<string, string> {
  const token = cleanApiKey(apiKey || "") || "public";
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    "x-opencode-client": "desktop",
    ...(stream ? { accept: "text/event-stream" } : {})
  };
}

export class OpenCodeExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const model = resolveOpenCodeModel(provider.model);
    const surface = zenSurfaceForModel(model, provider);
    const key = apiKey ?? provider.apiKey;
    const stream = Boolean(body?.stream);

    if (surface === "gemini") {
      const geminiBody = toGeminiRequest({ ...body, model });
      const response = await proxyFetch(provider, zenUrl(provider, model, surface, stream), {
        method: "POST",
        headers: opencodeHeaders(key, stream),
        body: JSON.stringify(geminiBody)
      });
      if (!response.ok) throw await upstreamError(provider, response);
      if (stream) {
        if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
        return geminiStreamToOpenAiSse(response.body, { ...provider, model }, () => {});
      }
      return fromGeminiResponse({ ...provider, model }, await response.json());
    }

    let upstreamBody: Record<string, unknown>;
    if (surface === "messages") {
      upstreamBody = openAiChatToClaudeRequest({ ...body, model });
    } else if (surface === "responses") {
      upstreamBody = openAiChatToResponsesRequest({ ...body, model });
      if (stream && !upstreamBody.stream) upstreamBody = { ...upstreamBody, stream: true };
    } else {
      upstreamBody = { ...body, model };
      if (stream) {
        const streamOptions = body.stream_options && typeof body.stream_options === "object" ? body.stream_options : {};
        upstreamBody.stream_options = { include_usage: true, ...streamOptions };
      }
    }

    const response = await proxyFetch(provider, zenUrl(provider, model, surface, stream), {
      method: "POST",
      headers: opencodeHeaders(key, stream),
      body: JSON.stringify(upstreamBody)
    });

    if (!response.ok) throw await upstreamError(provider, response);

    if (surface === "messages") {
      if (stream) {
        if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
        return claudeSseToOpenAiSse(response.body, model);
      }
      return claudeResponseToOpenAi(await response.json(), model);
    }

    if (surface === "responses") {
      if (stream || upstreamBody.stream) {
        if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
        return responsesSseToOpenAiSse(response.body, model);
      }
      return responsesResponseToOpenAi(await response.json(), model);
    }

    if (stream) return response.body ?? new ReadableStream<Uint8Array>();
    return response.json();
  }

  async listModels(provider: ProviderConfig) {
    const response = await proxyFetch(provider, modelsUrl(provider), {
      headers: opencodeHeaders(provider.apiKey, false)
    });

    if (!response.ok) throw await upstreamError(provider, response);
    const payload = await response.json();
    const ids = sortModelIds((payload?.data ?? []).map((model: any) => String(model?.id ?? "")).filter(Boolean));
    const key = cleanApiKey(provider.apiKey);
    if (provider.id === "opencode-free" && (!key || key === "public")) {
      const free = ids.filter((id) => FREE_MODELS.includes(id as (typeof FREE_MODELS)[number]));
      return free.length ? free : [...FREE_MODELS];
    }
    if (provider.id === "opencode-go" && provider.models?.length) {
      const preferred = provider.models.filter((id) => ids.includes(id));
      return preferred.length ? preferred : ids.length ? ids : [...provider.models];
    }
    return ids;
  }

  async validate(provider: ProviderConfig) {
    const models = await this.listModels(provider);
    return { models, message: models.length ? `${models.length} models found.` : "OpenCode connected." };
  }
}
