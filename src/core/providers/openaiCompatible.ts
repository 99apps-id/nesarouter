import { ProviderConfig } from "@/core/types";
import {
  baseUrl,
  cleanApiKey,
  openRouterHeaders,
  ProviderExecutor,
  proxyFetch,
  sortModelIds,
  upstreamError,
  xiaomiMimoAuthHeaders,
  xiaomiMimoCredentialHint
} from "@/core/providers/shared";

/** DeepSeek V4/reasoner defaults thinking on; agent clients often drop reasoning_content → 400. */
export function shouldDisableDeepSeekThinking(provider: ProviderConfig, body: any): boolean {
  if (body?.thinking != null) return false;
  const host = baseUrl(provider).toLowerCase();
  const model = String(provider.model ?? body?.model ?? "").toLowerCase();
  const id = provider.id.toLowerCase();
  const isDeepSeekHost = host.includes("deepseek.com") || id === "deepseek";
  const isDeepSeekModel = /deepseek/.test(model) && (/reasoner|v4|thinking|:v4@/.test(model) || isDeepSeekHost);
  return isDeepSeekHost || isDeepSeekModel;
}

export class OpenAiCompatibleExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.apiKey);
    const mismatch = xiaomiMimoCredentialHint(provider, token);
    if (mismatch) throw new Error(mismatch);
    const authHeaders: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    const upstreamBody: Record<string, unknown> = {
      ...body,
      model: provider.model
    };

    if (shouldDisableDeepSeekThinking(provider, body)) {
      upstreamBody.thinking = { type: "disabled" };
    }

    if (body?.stream) {
      const streamOptions = body.stream_options && typeof body.stream_options === "object" ? body.stream_options : {};
      upstreamBody.stream_options = { include_usage: true, ...streamOptions };
    }

    const response = await proxyFetch(provider, `${baseUrl(provider)}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders,
        ...xiaomiMimoAuthHeaders(token, provider),
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
    const mismatch = xiaomiMimoCredentialHint(provider, token);
    if (mismatch) throw new Error(mismatch);
    const authHeaders: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    let lastError: unknown;

    for (const url of urls) {
      const response = await proxyFetch(provider, url, {
        headers: {
          "content-type": "application/json",
          ...authHeaders,
          ...xiaomiMimoAuthHeaders(token, provider),
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
