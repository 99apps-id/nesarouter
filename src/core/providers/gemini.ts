import { geminiStreamToOpenAiSse } from "@/core/streaming";
import { ProviderConfig } from "@/core/types";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, sortModelIds, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

function normalizeGeminiModelName(name: string) {
  return name.replace(/^models\//, "");
}

export function geminiRole(role: string) {
  return role === "assistant" || role === "model" ? "model" : "user";
}

export function textFromContent(content: any) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === "string" ? part : part?.text ?? "")).join("\n");
  return "";
}

function imagePartFromOpenAi(part: any): { inlineData: { mimeType: string; data: string } } | { text: string } | null {
  const url = part?.image_url?.url ?? part?.image_url;
  if (typeof url !== "string" || !url) return null;
  const dataUrl = url.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrl) {
    return { inlineData: { mimeType: dataUrl[1], data: dataUrl[2] } };
  }
  // Gemini cannot fetch remote URLs in generateContent without Files API — keep a text hint.
  return { text: `[image: ${url.slice(0, 200)}]` };
}

function partsFromContent(content: unknown): any[] {
  if (typeof content === "string") return content ? [{ text: content }] : [];
  if (!Array.isArray(content)) return [];
  const parts: any[] = [];
  for (const part of content) {
    if (typeof part === "string") {
      if (part) parts.push({ text: part });
      continue;
    }
    if (part?.type === "image_url" || part?.image_url) {
      const image = imagePartFromOpenAi(part);
      if (image) parts.push(image);
      continue;
    }
    if (typeof part?.text === "string" && part.text) parts.push({ text: part.text });
  }
  return parts;
}

function functionDeclarationsFromTools(tools: any[] | undefined) {
  if (!Array.isArray(tools) || !tools.length) return undefined;
  const declarations = tools
    .map((tool) => {
      const fn = tool?.function ?? tool;
      if (!fn?.name) return null;
      return {
        name: String(fn.name),
        description: fn.description ? String(fn.description) : undefined,
        parameters: fn.parameters ?? { type: "object", properties: {} }
      };
    })
    .filter(Boolean);
  return declarations.length ? declarations : undefined;
}

export function toGeminiRequest(body: any) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const systemParts = messages
    .filter((message: any) => message?.role === "system")
    .flatMap((message: any) => partsFromContent(message.content))
    .filter((part: any) => part.text || part.inlineData);

  const toolNameById = new Map<string, string>();
  const contents: any[] = [];
  for (const message of messages) {
    if (message?.role === "system") continue;
    if (message?.role === "tool") {
      const id = typeof message.tool_call_id === "string" ? message.tool_call_id : "";
      const name = message.name || (id ? toolNameById.get(id) : undefined) || "tool";
      const response = textFromContent(message.content);
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name, response: { content: response } } }]
      });
      continue;
    }
    if (message?.role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length) {
      const parts = [
        ...partsFromContent(message.content),
        ...message.tool_calls.map((tc: any) => {
          const name = tc?.function?.name ?? "tool";
          if (typeof tc?.id === "string" && tc.id) toolNameById.set(tc.id, String(name));
          return {
            functionCall: {
              name,
              args: (() => {
                try {
                  return JSON.parse(tc?.function?.arguments || "{}");
                } catch {
                  return { raw: tc?.function?.arguments ?? "" };
                }
              })()
            }
          };
        })
      ];
      contents.push({ role: "model", parts: parts.length ? parts : [{ text: "" }] });
      continue;
    }
    const parts = partsFromContent(message?.content);
    if (!parts.length) continue;
    contents.push({ role: geminiRole(message?.role ?? "user"), parts });
  }

  const functionDeclarations = functionDeclarationsFromTools(body?.tools);

  return {
    contents: contents.length ? contents : [{ role: "user", parts: [{ text: String(body?.input ?? "") }] }],
    systemInstruction: systemParts.length ? { parts: systemParts } : undefined,
    tools: functionDeclarations ? [{ functionDeclarations }] : undefined,
    generationConfig: {
      temperature: body?.temperature,
      topP: body?.top_p,
      maxOutputTokens: body?.max_tokens
    }
  };
}

function geminiText(response: any) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part: any) => part?.text ?? "").filter(Boolean).join("");
}

function geminiToolCalls(response: any) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const calls = parts
    .filter((part: any) => part?.functionCall?.name)
    .map((part: any, index: number) => ({
      id: `call_${part.functionCall.name}_${index}`,
      type: "function" as const,
      function: {
        name: String(part.functionCall.name),
        arguments: JSON.stringify(part.functionCall.args ?? {})
      }
    }));
  return calls.length ? calls : undefined;
}

/** Cloud Code wraps Gemini payloads as `{ response: { candidates, usageMetadata } }`. */
export function unwrapGeminiPayload(payload: any): any {
  if (payload && typeof payload === "object" && payload.response && typeof payload.response === "object") {
    return payload.response;
  }
  return payload;
}

export function fromGeminiResponse(provider: ProviderConfig, response: any) {
  const unwrapped = unwrapGeminiPayload(response);
  const usage = unwrapped?.usageMetadata ?? {};
  const toolCalls = geminiToolCalls(unwrapped);
  const text = geminiText(unwrapped);
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
          content: text || null,
          ...(toolCalls ? { tool_calls: toolCalls } : {})
        },
        finish_reason: toolCalls ? "tool_calls" : unwrapped?.candidates?.[0]?.finishReason?.toLowerCase?.() ?? "stop"
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
