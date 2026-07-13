import { ProviderConfig } from "@/core/types";
import { getPreset } from "@/core/oauthProviderPresets";
import { openAiChatToResponsesRequest, responsesResponseToOpenAi, responsesSseToOpenAiSse } from "@/core/translatorReverse";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, upstreamError } from "@/core/providers/shared";

export class OpenAiResponsesExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? "");
    const preset = getPreset(provider.oauthProfile);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(preset?.upstreamHeaders ?? {})
    };

    const request = openAiChatToResponsesRequest({ ...body, model: provider.model });
    const forceStream = preset?.profile === "openai_codex";
    const wantStream = Boolean(body?.stream) || forceStream;
    const finalRequest = wantStream && !request.stream ? { ...request, stream: true } : request;

    const response = await proxyFetch(provider, baseUrl(provider), {
      method: "POST",
      headers,
      body: JSON.stringify(finalRequest)
    });

    if (!response.ok) throw await upstreamError(provider, response);
    if (wantStream) {
      if (!response.body) throw new Error(`${provider.name} returned no stream body.`);
      return responsesSseToOpenAiSse(response.body, provider.model);
    }
    const payload = await response.json();
    return responsesResponseToOpenAi(payload, provider.model);
  }

  async listModels(_provider: ProviderConfig): Promise<string[]> {
    return [];
  }
}
