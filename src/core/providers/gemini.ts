import { geminiStreamToOpenAiSse } from "@/core/streaming";
import { ProviderConfig } from "@/core/types";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, sortModelIds, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

function normalizeGeminiModelName(name: string) {
  return name.replace(/^models\//, "");
}

export function geminiRole(role: string) {
  return role === "assistant" ? "model" : "user";
}

export function textFromContent(content: any) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part?.text ?? "").join("\n");
  return "";
}

export function toGeminiRequest(body: any) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const systemParts = messages
    .filter((message: any) => message?.role === "system")
    .map((message: any) => ({ text: textFromContent(message.content) }))
    .filter((part: any) => part.text);

  const contents = messages
    .filter((message: any) => message?.role !== "system")
    .map((message: any) => ({
      role: geminiRole(message?.role ?? "user"),
      parts: [{ text: textFromContent(message?.content) }]
    }))
    .filter((content: any) => content.parts[0].text);

  return {
    contents: contents.length ? contents : [{ role: "user", parts: [{ text: String(body?.input ?? "") }] }],
    systemInstruction: systemParts.length ? { parts: systemParts } : undefined,
    generationConfig: {
      temperature: body?.temperature,
      topP: body?.top_p,
      maxOutputTokens: body?.max_tokens
    }
  };
}

function geminiText(response: any) {
  return response?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? "").join("") ?? "";
}

export function fromGeminiResponse(provider: ProviderConfig, response: any) {
  const usage = response?.usageMetadata ?? {};
  return {
    id: `gemini-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: provider.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: geminiText(response)
        },
        finish_reason: response?.candidates?.[0]?.finishReason?.toLowerCase?.() ?? "stop"
      }
    ],
    usage: {
      prompt_tokens: usage.promptTokenCount ?? 0,
      completion_tokens: usage.candidatesTokenCount ?? 0,
      total_tokens: usage.totalTokenCount ?? 0
    }
  };
}

export class GeminiExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const key = cleanApiKey(apiKey ?? provider.apiKey);
    if (body?.stream) return this.callStream(provider, body, key);

    const endpoint = `${baseUrl(provider)}/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await proxyFetch(provider, endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toGeminiRequest(body))
    });

    if (!response.ok) throw await upstreamError(provider, response);
    return fromGeminiResponse(provider, await response.json());
  }

  async listModels(provider: ProviderConfig) {
    const response = await proxyFetch(provider, `${baseUrl(provider)}/models?key=${encodeURIComponent(cleanApiKey(provider.apiKey))}`, {
      headers: { "content-type": "application/json" }
    });

    if (!response.ok) throw await upstreamError(provider, response);
    const payload = await response.json();
    const modelIds = (payload?.models ?? [])
      .filter((model: any) => Array.isArray(model?.supportedGenerationMethods) ? model.supportedGenerationMethods.includes("generateContent") : true)
      .map((model: any) => normalizeGeminiModelName(String(model?.name ?? "")))
      .filter(Boolean);
    return sortModelIds(modelIds);
  }

  async validate(provider: ProviderConfig) {
    const models = await this.listModels(provider);
    return { models, message: models.length ? `${models.length} models found.` : "Credentials accepted." };
  }

  private async callStream(provider: ProviderConfig, body: any, key: string) {
    const endpoint = `${baseUrl(provider)}/models/${encodeURIComponent(provider.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
    const response = await proxyFetch(provider, endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toGeminiRequest(body))
    });

    if (!response.ok) throw await upstreamError(provider, response);
    if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
    return geminiStreamToOpenAiSse(response.body, provider, () => {});
  }
}
