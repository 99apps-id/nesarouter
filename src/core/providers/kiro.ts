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

function serializeToolContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  try { return JSON.stringify(content); } catch { return String(content); }
}

/** Translate OpenAI chat history into Kiro's native conversation/tool protocol. */
export function kiroRequest(body: any, model: string, profileArn?: string) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const modelId = upstreamModel(model);
  const tools = (Array.isArray(body?.tools) ? body.tools : [])
    .map((tool: any) => tool?.function ?? tool)
    .filter((tool: any) => typeof tool?.name === "string" && tool.name)
    .map((tool: any) => ({
      toolSpecification: {
        name: tool.name,
        description: tool.description || `Tool: ${tool.name}`,
        inputSchema: { json: tool.parameters ?? tool.input_schema ?? { type: "object", properties: {} } }
      }
    }));

  const turns: any[] = [];
  for (const message of messages) {
    if (message?.role === "assistant") {
      const toolUses = (Array.isArray(message.tool_calls) ? message.tool_calls : []).map((call: any) => {
        let input: unknown = {};
        try { input = JSON.parse(call?.function?.arguments || "{}"); } catch { input = {}; }
        return { toolUseId: call?.id || crypto.randomUUID(), name: call?.function?.name || "tool", input };
      });
      turns.push({ assistantResponseMessage: {
        content: textFromContent(message.content),
        ...(toolUses.length ? { toolUses } : {})
      } });
      continue;
    }
    if (message?.role === "tool") {
      turns.push({ userInputMessage: {
        content: "",
        modelId,
        origin: "AI_EDITOR",
        userInputMessageContext: { toolResults: [{
          toolUseId: message.tool_call_id,
          status: "success",
          content: [{ text: serializeToolContent(message.content) }]
        }] }
      } });
      continue;
    }
    const content = textFromContent(message?.content);
    if (content) turns.push({ userInputMessage: {
      content: message?.role === "system" ? `<system-reminder>\n${content}\n</system-reminder>` : content,
      modelId,
      origin: "AI_EDITOR"
    } });
  }

  let currentMessage = turns.pop();
  if (!currentMessage?.userInputMessage) {
    if (currentMessage) turns.push(currentMessage);
    currentMessage = { userInputMessage: { content: "Continue the conversation.", modelId, origin: "AI_EDITOR" } };
  }
  if (tools.length) {
    currentMessage.userInputMessage.userInputMessageContext = {
      ...(currentMessage.userInputMessage.userInputMessageContext ?? {}), tools
    };
  }

  return {
    conversationState: {
      chatTriggerType: "MANUAL",
      conversationId: crypto.randomUUID(),
      currentMessage,
      history: turns
    },
    ...(profileArn ? { profileArn } : {}),
    inferenceConfig: {
      maxTokens: Math.min(Math.max(Number(body?.max_tokens ?? 8192), 1), 32000),
      ...(typeof body?.temperature === "number" ? { temperature: body.temperature } : {}),
      ...(typeof body?.top_p === "number" ? { topP: body.top_p } : {})
    }
  };
}

function kiroAmzTarget(apiKeyMode: boolean, useAmazonQFallback: boolean) {
  if (useAmazonQFallback) return "AmazonQDeveloperStreamingService.SendMessage";
  return "AmazonCodeWhispererStreamingService.GenerateAssistantResponse";
}

function kiroHeaders(
  token: string,
  apiKeyMode: boolean,
  accept = "application/vnd.amazon.eventstream",
  includeTarget = true,
  useAmazonQFallback = false
) {
  return {
    authorization: `Bearer ${cleanApiKey(token)}`,
    "content-type": "application/json",
    accept,
    ...(includeTarget ? { "x-amz-target": kiroAmzTarget(apiKeyMode, useAmazonQFallback) } : {}),
    "user-agent": "AWS-SDK-JS/3.0.0 kiro-ide/1.0.0",
    "x-amz-user-agent": "aws-sdk-js/3.0.0 kiro-ide/1.0.0",
    "amz-sdk-request": "attempt=1; max=1",
    "amz-sdk-invocation-id": crypto.randomUUID(),
    ...(apiKeyMode ? { tokentype: "API_KEY" } : {})
  };
}

/** Builder ID OAuth accounts often have no profileArn; runtime.kiro.dev then 400s. */
export function shouldUseKiroAmazonQFallback(provider: ProviderConfig, apiKeyMode: boolean, profileArn?: string) {
  if (apiKeyMode || profileArn) return false;
  if (provider.oauthProfile !== "kiro") return false;
  return /runtime\..*\.kiro\.dev/i.test(baseUrl(provider));
}

export function endpointFor(provider: ProviderConfig, apiKeyMode: boolean, useAmazonQFallback = false) {
  const configured = baseUrl(provider);
  // Kiro API keys authenticate against the CodeWhisperer surface. OAuth tokens
  // can use the Kiro runtime URL configured by the user.
  if (apiKeyMode && /runtime\..*\.kiro\.dev/i.test(configured)) {
    return "https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse";
  }
  if (useAmazonQFallback) {
    return "https://q.us-east-1.amazonaws.com";
  }
  return configured;
}

function resolveKiroProfileArn(provider: ProviderConfig): string | undefined {
  // Prefer the active account snapshot (set by providerForOAuthAccount); do not walk siblings.
  return provider.oauthProfileArn?.trim() || undefined;
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
  let sawToolUse = false;
  const toolIndexById = new Map<string, number>();
  let nextToolIndex = 0;

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
        if (event.eventType === "toolUseEvent") {
          const toolUse = payload.toolUseEvent ?? payload;
          if (toolUse.name || toolUse.toolUseId) {
            const input = toolUse.input ?? {};
            const toolUseId = toolUse.toolUseId || `call_${crypto.randomUUID()}`;
            let index = toolIndexById.get(toolUseId);
            if (index == null) {
              index = nextToolIndex++;
              toolIndexById.set(toolUseId, index);
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk(model, {
              ...(sawAssistant ? {} : { role: "assistant" }),
              tool_calls: [{
                index,
                id: toolUseId,
                type: "function",
                function: { name: toolUse.name || "tool", arguments: typeof input === "string" ? input : JSON.stringify(input) }
              }]
            }))}\n\n`));
            sawAssistant = true;
            sawToolUse = true;
          }
        }
        if (event.eventType === "metricsEvent") {
          const metrics = payload.metricsEvent ?? payload;
          const promptTokens = Number(metrics.inputTokens ?? 0);
          const completionTokens = Number(metrics.outputTokens ?? 0);
          if (promptTokens || completionTokens) usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens };
        }
        if (event.eventType === "messageStopEvent" && !sentFinish) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk(model, {}, sawToolUse ? "tool_calls" : "stop", usage))}\n\n`));
          sentFinish = true;
        }
      }
    },
    flush(controller) {
      if (!sentFinish) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk(model, {}, sawToolUse ? "tool_calls" : "stop", usage))}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    }
  }));
}

function isKiroProfileArnRequiredError(error: UpstreamProviderError) {
  return /profilearn|profile.?arn.*required/i.test(error.message);
}

export class KiroExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string): Promise<ReadableStream<Uint8Array>> {
    const token = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? provider.apiKey ?? "");
    if (!token) throw new UpstreamProviderError(`${provider.name} needs a Kiro API key or access token.`, 400);
    // OAuth Builder ID tokens must not send tokentype=API_KEY.
    const apiKeyMode = !provider.oauthProfile && Boolean(cleanApiKey(provider.apiKey) || (apiKey && apiKey !== provider.oauthAccessToken));
    const profileArn = resolveKiroProfileArn(provider);
    const preferQ = shouldUseKiroAmazonQFallback(provider, apiKeyMode, profileArn);

    const tryOnce = async (useAmazonQFallback: boolean, arn?: string) => {
      const response = await proxyFetch(provider, endpointFor(provider, apiKeyMode, useAmazonQFallback), {
        method: "POST",
        headers: kiroHeaders(token, apiKeyMode, "application/vnd.amazon.eventstream", true, useAmazonQFallback),
        body: JSON.stringify(kiroRequest(body, provider.model, useAmazonQFallback ? undefined : arn))
      });
      if (!response.ok) throw await upstreamError(provider, response);
      if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no event stream.`, 502);
      return kiroEventStreamToOpenAiSse(response.body, provider.model);
    };

    try {
      return await tryOnce(preferQ, profileArn);
    } catch (error) {
      // Builder ID + runtime.kiro.dev often 400s on missing/invalid profileArn — fall back to Amazon Q.
      if (
        !preferQ &&
        !apiKeyMode &&
        provider.oauthProfile === "kiro" &&
        error instanceof UpstreamProviderError &&
        (error.status === 400 || isKiroProfileArnRequiredError(error))
      ) {
        return tryOnce(true);
      }
      throw error;
    }
  }

  async listModels(provider: ProviderConfig) {
    const preset = provider.models?.length ? provider.models : [];
    return preset.length ? preset : ["claude-sonnet-4.5", "claude-haiku-4.5"];
  }

  /**
   * Soft credential check (matches 9router: expiry/token presence, not a hard
   * ListAvailableModels requirement). Aggressive probes were flipping Builder ID
   * accounts to `error` and skipping them in routing after a successful Connect.
   */
  async validate(provider: ProviderConfig) {
    const isOauth = provider.oauthProfile === "kiro";
    const token = cleanApiKey(
      isOauth ? provider.oauthAccessToken || provider.apiKey || "" : provider.apiKey || provider.oauthAccessToken || ""
    );
    if (!token) throw new UpstreamProviderError(`${provider.name} needs a Kiro API key or access token.`, 400);

    const fallbackModels = await this.listModels(provider);

    // OAuth Builder ID: token present = connected. Optional soft model list.
    if (isOauth) {
      const apiKeyMode = false;
      try {
        const response = await proxyFetch(provider, "https://q.us-east-1.amazonaws.com/ListAvailableModels?origin=AI_EDITOR", {
          headers: kiroHeaders(token, apiKeyMode, "application/json", false),
          signal: AbortSignal.timeout(12_000)
        });
        if (response.status === 401) throw await upstreamError(provider, response);
        if (response.ok) {
          const payload = await response.json().catch(() => ({}));
          const models = Array.isArray(payload?.models)
            ? payload.models.map((item: any) => String(item?.modelId ?? item?.id ?? "")).filter(Boolean)
            : fallbackModels;
          return {
            models: models.length ? models : fallbackModels,
            message: models.length
              ? `Kiro Builder ID accepted · ${models.length} models.`
              : "Kiro Builder ID token accepted."
          };
        }
        // 403/4xx/5xx from list endpoint — still mark connected if we have a token.
        return {
          models: fallbackModels,
          message: "Kiro Builder ID token accepted (model list unavailable; chat uses Amazon Q fallback when needed)."
        };
      } catch (error) {
        if (error instanceof UpstreamProviderError && error.status === 401) throw error;
        return {
          models: fallbackModels,
          message: "Kiro Builder ID token accepted (soft check; reconnect if chat fails)."
        };
      }
    }

    const apiKeyMode = Boolean(cleanApiKey(provider.apiKey));
    const response = await proxyFetch(provider, "https://q.us-east-1.amazonaws.com/ListAvailableModels?origin=AI_EDITOR", {
      headers: kiroHeaders(token, apiKeyMode, "application/json", false)
    });
    if (!response.ok) throw await upstreamError(provider, response);
    const payload = await response.json().catch(() => ({}));
    const models = Array.isArray(payload?.models)
      ? payload.models.map((item: any) => String(item?.modelId ?? item?.id ?? "")).filter(Boolean)
      : fallbackModels;
    return { models: models.length ? models : fallbackModels, message: models.length ? `${models.length} Kiro models available.` : "Kiro credentials accepted." };
  }
}
