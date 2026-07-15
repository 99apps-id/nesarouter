import { ProviderConfig } from "@/core/types";
import { getPreset } from "@/core/oauthProviderPresets";
import { claudeResponseToOpenAi, claudeSseToOpenAiSse, openAiChatToClaudeRequest } from "@/core/translatorReverse";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

function anthropicMessagesUrl(provider: ProviderConfig): string {
  const root = baseUrl(provider).replace(/\/$/, "");
  if (/\/v1\/messages$/i.test(root)) return root;
  if (/\/v1$/i.test(root)) return `${root}/messages`;
  return `${root}/v1/messages`;
}

function anthropicAuthHeaders(provider: ProviderConfig, token: string): Record<string, string> {
  const preset = getPreset(provider.oauthProfile);
  if (provider.oauthProfile || preset) {
    return {
      authorization: `Bearer ${token}`,
      ...(preset?.upstreamHeaders ?? {})
    };
  }
  return {
    "x-api-key": token,
    "anthropic-version": "2023-06-01"
  };
}

export class AnthropicMessagesExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? provider.apiKey ?? "");
    if (!token) throw new UpstreamProviderError(`${provider.name} has no API key or OAuth token.`, 401);

    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...anthropicAuthHeaders(provider, token)
    };

    const request = openAiChatToClaudeRequest({ ...body, model: provider.model });
    const response = await proxyFetch(provider, anthropicMessagesUrl(provider), {
      method: "POST",
      headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) throw await upstreamError(provider, response);
    if (body?.stream) {
      if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
      return claudeSseToOpenAiSse(response.body, provider.model);
    }
    const payload = await response.json();
    return claudeResponseToOpenAi(payload, provider.model);
  }

  async listModels(provider: ProviderConfig): Promise<string[]> {
    if (provider.models?.length) return [...provider.models];
    return provider.model ? [provider.model] : [];
  }

  async validate(provider: ProviderConfig) {
    const token = cleanApiKey(provider.oauthAccessToken || provider.apiKey || "");
    if (!token) throw new UpstreamProviderError(`${provider.name} needs an API key or OAuth token.`, 400);
    const models = await this.listModels(provider);

    // OAuth subscription: soft check (9router-style). A live Messages call burns quota and
    // intermittent 429/5xx was flipping accounts to error on the 45s probe.
    if (provider.oauthProfile) {
      if (token.length < 20) {
        throw new UpstreamProviderError("Claude OAuth token looks too short — reconnect.", 400);
      }
      return { models, message: "Claude OAuth token present." };
    }

    // API key: soft probe — only hard-fail on auth rejection.
    try {
      const response = await proxyFetch(provider, anthropicMessagesUrl(provider), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...anthropicAuthHeaders(provider, token)
        },
        body: JSON.stringify({
          model: provider.model || "claude-sonnet-4-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }]
        }),
        signal: AbortSignal.timeout(12_000)
      });
      if (response.status === 401 || response.status === 403) throw await upstreamError(provider, response);
      return {
        models,
        message: `Anthropic API key accepted${models.length ? ` · ${models.length} preset models` : ""}.`
      };
    } catch (error) {
      if (error instanceof UpstreamProviderError && [401, 403].includes(error.status)) throw error;
      return {
        models,
        message: `Anthropic API key present${models.length ? ` · ${models.length} preset models` : ""} (soft check).`
      };
    }
  }
}
