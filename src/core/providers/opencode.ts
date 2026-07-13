import { ProviderConfig } from "@/core/types";
import { baseUrl, ProviderExecutor, proxyFetch, sortModelIds, upstreamError } from "@/core/providers/shared";

const MESSAGES_MODELS = new Set<string>();

function chatUrl(provider: ProviderConfig, model: string) {
  const root = baseUrl(provider);
  return MESSAGES_MODELS.has(model) ? `${root}/zen/v1/messages` : `${root}/zen/v1/chat/completions`;
}

function modelsUrl(provider: ProviderConfig) {
  return `${baseUrl(provider)}/zen/v1/models`;
}

function opencodeHeaders(stream = true): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: "Bearer public",
    "x-opencode-client": "desktop",
    ...(stream ? { accept: "text/event-stream" } : {})
  };
}

export class OpenCodeExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any) {
    const upstreamBody: Record<string, unknown> = {
      ...body,
      model: provider.model
    };

    if (body?.stream) {
      const streamOptions = body.stream_options && typeof body.stream_options === "object" ? body.stream_options : {};
      upstreamBody.stream_options = { include_usage: true, ...streamOptions };
    }

    const response = await proxyFetch(provider, chatUrl(provider, provider.model), {
      method: "POST",
      headers: opencodeHeaders(Boolean(body?.stream)),
      body: JSON.stringify(upstreamBody)
    });

    if (!response.ok) throw await upstreamError(provider, response);
    if (body?.stream) return response.body ?? new ReadableStream<Uint8Array>();
    return response.json();
  }

  async listModels(provider: ProviderConfig) {
    const response = await proxyFetch(provider, modelsUrl(provider), {
      headers: opencodeHeaders(false)
    });

    if (!response.ok) throw await upstreamError(provider, response);
    const payload = await response.json();
    return sortModelIds((payload?.data ?? []).map((model: any) => String(model?.id ?? "")).filter(Boolean));
  }

  async validate(provider: ProviderConfig) {
    const models = await this.listModels(provider);
    return { models, message: models.length ? `${models.length} models found.` : "OpenCode Free connected." };
  }
}
