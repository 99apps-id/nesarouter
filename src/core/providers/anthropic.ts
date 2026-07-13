import { ProviderConfig } from "@/core/types";
import { getPreset } from "@/core/oauthProviderPresets";
import { claudeResponseToOpenAi, claudeSseToOpenAiSse, openAiChatToClaudeRequest } from "@/core/translatorReverse";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, upstreamError } from "@/core/providers/shared";

export class AnthropicMessagesExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? "");
    const preset = getPreset(provider.oauthProfile);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(preset?.upstreamHeaders ?? {})
    };

    const request = openAiChatToClaudeRequest({ ...body, model: provider.model });
    const response = await proxyFetch(provider, baseUrl(provider), {
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

  async listModels(_provider: ProviderConfig): Promise<string[]> {
    return [];
  }
}
