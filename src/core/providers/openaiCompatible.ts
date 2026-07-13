import { ProviderConfig } from "@/core/types";
import { baseUrl, cleanApiKey, openRouterHeaders, ProviderExecutor, proxyFetch, sortModelIds, upstreamError } from "@/core/providers/shared";

export class OpenAiCompatibleExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.apiKey);
    const authHeaders: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    const upstreamBody: Record<string, unknown> = {
      ...body,
      model: provider.model
    };

    if (body?.stream) {
      const streamOptions = body.stream_options && typeof body.stream_options === "object" ? body.stream_options : {};
      upstreamBody.stream_options = { include_usage: true, ...streamOptions };
    }

    const response = await proxyFetch(provider, `${baseUrl(provider)}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders,
        ...openRouterHeaders(provider)
      },
      body: JSON.stringify(upstreamBody)
    });

    if (!response.ok) throw await upstreamError(provider, response);
    if (body?.stream) return response.body ?? new ReadableStream<Uint8Array>();
    return response.json();
  }

  async listModels(provider: ProviderConfig) {
    const urls = this.modelUrls(provider);
    const token = cleanApiKey(provider.apiKey);
    const authHeaders: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    let lastError: unknown;

    for (const url of urls) {
      const response = await proxyFetch(provider, url, {
        headers: {
          "content-type": "application/json",
          ...authHeaders,
          ...openRouterHeaders(provider)
        }
      });

      if (response.ok) {
        const payload = await response.json();
        return sortModelIds((payload?.data ?? []).map((model: any) => String(model?.id ?? "")).filter(Boolean));
      }

      lastError = await upstreamError(provider, response);
      if (![404, 405].includes((lastError as any)?.status)) throw lastError;
    }

    throw lastError instanceof Error ? lastError : new Error(`${provider.name} models endpoint is unavailable.`);
  }

  async validate(provider: ProviderConfig) {
    const models = await this.listModels(provider);
    return { models, message: models.length ? `${models.length} models found.` : "Credentials accepted." };
  }

  private modelUrls(provider: ProviderConfig) {
    const primary = baseUrl(provider);
    const urls = [`${primary}/models`];
    if (!/\/v1(?:\/)?$/i.test(primary) && !provider.baseUrl.includes("openrouter.ai")) {
      urls.push(`${primary}/v1/models`);
    }
    return urls;
  }
}
