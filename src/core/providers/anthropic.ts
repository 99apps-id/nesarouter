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
      if (!response.body) throw new Error(`${provider.name} returned no stream body.`);
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
    await this.call(provider, {
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 8,
      stream: false
    });
    const models = await this.listModels(provider);
    return {
      models,
      message: provider.oauthProfile
        ? "Claude OAuth token accepted."
        : `Anthropic API key accepted${models.length ? ` · ${models.length} preset models` : ""}.`
    };
  }
}
