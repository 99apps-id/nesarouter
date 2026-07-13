import crypto from "node:crypto";
import { ProviderConfig } from "@/core/types";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type KiroEvent = { eventType: string; payload: any };

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n");
}

function upstreamModel(model: string) {
  return model.replace(/-(thinking|agentic)(-agentic)?$/i, "");
}

function kiroRequest(body: any, model: string) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const transcript = messages
    .map((message: any) => {
      const content = textFromContent(message?.content);
      return content ? `${message?.role === "system" ? "System" : message?.role === "assistant" ? "Assistant" : "User"}: ${content}` : "";
    })
    .filter(Boolean);
  const lastUser = [...messages].reverse().find((message: any) => message?.role === "user");
  const userText = textFromContent(lastUser?.content);
  const context = transcript.length > 1 ? `${transcript.join("\n\n")}\n\n` : "";

  return {
    conversationState: {
      chatTriggerType: "MANUAL",
      conversationId: crypto.randomUUID(),
      currentMessage: {
        userInputMessage: {
          content: `${context}${userText || "Continue the conversation."}`,
          modelId: upstreamModel(model),
          origin: "AI_EDITOR"
        }
      },
      history: []
    },
    inferenceConfig: {
      maxTokens: Math.min(Math.max(Number(body?.max_tokens ?? 8192), 1), 32000),
      ...(typeof body?.temperature === "number" ? { temperature: body.temperature } : {}),
      ...(typeof body?.top_p === "number" ? { topP: body.top_p } : {})
    }
  };
}

function kiroHeaders(token: string, apiKeyMode: boolean, accept = "application/vnd.amazon.eventstream", includeTarget = true) {
  return {
    authorization: `Bearer ${cleanApiKey(token)}`,
    "content-type": "application/json",
    accept,
    ...(includeTarget ? { "x-amz-target": "AmazonCodeWhispererStreamingService.GenerateAssistantResponse" } : {}),
    "user-agent": "AWS-SDK-JS/3.0.0 kiro-ide/1.0.0",
    "x-amz-user-agent": "aws-sdk-js/3.0.0 kiro-ide/1.0.0",
    "amz-sdk-request": "attempt=1; max=1",
    "amz-sdk-invocation-id": crypto.randomUUID(),
    ...(apiKeyMode ? { tokentype: "API_KEY" } : {})
  };
}

function endpointFor(provider: ProviderConfig, apiKeyMode: boolean) {
  const configured = baseUrl(provider);
  // Kiro API keys authenticate against the CodeWhisperer surface. OAuth tokens
  // can use the Kiro runtime URL configured by the user.
  if (apiKeyMode && /runtime\..*\.kiro\.dev/i.test(configured)) {
    return "https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse";
  }
  return configured;
}

function parseHeaders(bytes: Uint8Array<ArrayBufferLike>): Record<string, string> {
  const headers: Record<string, string> = {};
  let offset = 0;
  while (offset < bytes.length) {
    const nameLength = bytes[offset++];
    if (!nameLength || offset + nameLength + 1 > bytes.length) break;
    const name = decoder.decode(bytes.slice(offset, offset + nameLength));
    offset += nameLength;
    const type = bytes[offset++];
    if (type !== 7 || offset + 2 > bytes.length) break; // AWS EventStream string
    const valueLength = new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, false);
    offset += 2;
    if (offset + valueLength > bytes.length) break;
    headers[name] = decoder.decode(bytes.slice(offset, offset + valueLength));
    offset += valueLength;
  }
  return headers;
}

function parseFrames(buffer: Uint8Array<ArrayBufferLike>): { events: KiroEvent[]; rest: Uint8Array<ArrayBufferLike> } {
  const events: KiroEvent[] = [];
  let offset = 0;
  while (buffer.length - offset >= 16) {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
    const totalLength = view.getUint32(0, false);
    const headersLength = view.getUint32(4, false);
    if (totalLength < 16 || totalLength > buffer.length - offset) break;
    const headersStart = offset + 12;
    const payloadStart = headersStart + headersLength;
    const payloadEnd = offset + totalLength - 4;
    if (payloadStart > payloadEnd) break;
    const headers = parseHeaders(buffer.slice(headersStart, payloadStart));
    const eventType = headers[":event-type"] ?? "";
    const rawPayload = decoder.decode(buffer.slice(payloadStart, payloadEnd));
    try {
      events.push({ eventType, payload: rawPayload ? JSON.parse(rawPayload) : {} });
    } catch {
      // Invalid event payloads are ignored, but the stream stays usable.
    }
    offset += totalLength;
  }
  return { events, rest: buffer.slice(offset) };
}

function chunk(model: string, delta: Record<string, unknown>, finishReason: string | null = null, usage?: Record<string, number>) {
  return {
    id: `chatcmpl-kiro-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
    ...(usage ? { usage } : {})
  };
}

/** Convert Kiro's binary AWS EventStream into OpenAI-compatible SSE. */
export function kiroEventStreamToOpenAiSse(input: ReadableStream<Uint8Array>, model: string) {
  let buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let sentFinish = false;
  let sawAssistant = false;
  let usage: Record<string, number> | undefined;

  return input.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(part, controller) {
      const combined = new Uint8Array(buffer.length + part.length);
      combined.set(buffer);
      combined.set(part, buffer.length);
      const parsed = parseFrames(combined);
      buffer = parsed.rest;

      for (const event of parsed.events) {
        const payload = event.payload ?? {};
        if ((event.eventType === "assistantResponseEvent" || event.eventType === "codeEvent") && payload.content) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk(model, sawAssistant ? { content: payload.content } : { role: "assistant", content: payload.content }))}\n\n`));
          sawAssistant = true;
        }
        if (event.eventType === "reasoningContentEvent") {
          const content = payload.reasoningContentEvent?.content ?? payload.content ?? payload.text;
          if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk(model, { reasoning_content: content }))}\n\n`));
        }
        if (event.eventType === "metricsEvent") {
          const metrics = payload.metricsEvent ?? payload;
          const promptTokens = Number(metrics.inputTokens ?? 0);
          const completionTokens = Number(metrics.outputTokens ?? 0);
          if (promptTokens || completionTokens) usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens };
        }
        if (event.eventType === "messageStopEvent" && !sentFinish) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk(model, {}, "stop", usage))}\n\n`));
          sentFinish = true;
        }
      }
    },
    flush(controller) {
      if (!sentFinish) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk(model, {}, "stop", usage))}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    }
  }));
}

export class KiroExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string): Promise<ReadableStream<Uint8Array>> {
    const token = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? provider.apiKey ?? "");
    if (!token) throw new UpstreamProviderError(`${provider.name} needs a Kiro API key or access token.`, 400);
    // OAuth Builder ID tokens must not send tokentype=API_KEY.
    const apiKeyMode = !provider.oauthProfile && Boolean(cleanApiKey(provider.apiKey) || (apiKey && apiKey !== provider.oauthAccessToken));
    const response = await proxyFetch(provider, endpointFor(provider, apiKeyMode), {
      method: "POST",
      headers: kiroHeaders(token, apiKeyMode),
      body: JSON.stringify(kiroRequest(body, provider.model))
    });
    if (!response.ok) throw await upstreamError(provider, response);
    if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no event stream.`, 502);
    return kiroEventStreamToOpenAiSse(response.body, provider.model);
  }

  async listModels(provider: ProviderConfig) {
    return provider.models ?? [];
  }

  async validate(provider: ProviderConfig) {
    const token = cleanApiKey(provider.apiKey || provider.oauthAccessToken || "");
    if (!token) throw new UpstreamProviderError(`${provider.name} needs a Kiro API key or access token.`, 400);
    const apiKeyMode = !provider.oauthProfile && Boolean(cleanApiKey(provider.apiKey));
    const response = await proxyFetch(provider, "https://q.us-east-1.amazonaws.com/ListAvailableModels?origin=AI_EDITOR", {
      headers: kiroHeaders(token, apiKeyMode, "application/json", false)
    });
    if (!response.ok) throw await upstreamError(provider, response);
    const payload = await response.json().catch(() => ({}));
    const models = Array.isArray(payload?.models)
      ? payload.models.map((item: any) => String(item?.modelId ?? item?.id ?? "")).filter(Boolean)
      : provider.models ?? [];
    return { models, message: models.length ? `${models.length} Kiro models available.` : "Kiro credentials accepted." };
  }
}
