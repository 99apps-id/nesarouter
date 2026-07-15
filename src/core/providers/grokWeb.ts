import { ProviderConfig } from "@/core/types";
import { ProviderExecutor, proxyFetch, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

const GROK_CHAT_API = "https://grok.com/rest/app-chat/conversations/new";
const GROK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export const GROK_WEB_MODEL_MAP: Record<
  string,
  { grokModel: string; modelMode: string; isThinking: boolean }
> = {
  "grok-3": { grokModel: "grok-3", modelMode: "MODEL_MODE_GROK_3", isThinking: false },
  "grok-3-mini": { grokModel: "grok-3", modelMode: "MODEL_MODE_GROK_3_MINI_THINKING", isThinking: true },
  "grok-3-thinking": { grokModel: "grok-3", modelMode: "MODEL_MODE_GROK_3_THINKING", isThinking: true },
  "grok-4": { grokModel: "grok-4", modelMode: "MODEL_MODE_GROK_4", isThinking: false },
  "grok-4-mini": { grokModel: "grok-4-mini", modelMode: "MODEL_MODE_GROK_4_MINI_THINKING", isThinking: true },
  "grok-4-thinking": { grokModel: "grok-4", modelMode: "MODEL_MODE_GROK_4_THINKING", isThinking: true },
  "grok-4-heavy": { grokModel: "grok-4", modelMode: "MODEL_MODE_HEAVY", isThinking: true },
  "grok-4.1-mini": { grokModel: "grok-4-1-thinking-1129", modelMode: "MODEL_MODE_GROK_4_1_MINI_THINKING", isThinking: true },
  "grok-4.1-fast": { grokModel: "grok-4-1-thinking-1129", modelMode: "MODEL_MODE_FAST", isThinking: false },
  "grok-4.1-expert": { grokModel: "grok-4-1-thinking-1129", modelMode: "MODEL_MODE_EXPERT", isThinking: true },
  "grok-4.1-thinking": { grokModel: "grok-4-1-thinking-1129", modelMode: "MODEL_MODE_GROK_4_1_THINKING", isThinking: true },
  "grok-4.2": { grokModel: "grok-420", modelMode: "MODEL_MODE_GROK_420", isThinking: false },
  "grok-4.20": { grokModel: "grok-420", modelMode: "MODEL_MODE_GROK_420", isThinking: false },
  "grok-4.20-beta": { grokModel: "grok-420", modelMode: "MODEL_MODE_GROK_420", isThinking: false }
};

export function normalizeGrokSsoCookie(raw: string | undefined | null): string {
  if (!raw?.trim()) return "";
  let token = raw.trim();
  if (token.toLowerCase().startsWith("sso=")) token = token.slice(4).trim();
  if (token.toLowerCase().startsWith("cookie:")) token = token.slice(7).trim();
  const cookieMatch = token.match(/(?:^|;\s*)sso=([^;]+)/i);
  if (cookieMatch) token = cookieMatch[1].trim();
  return token;
}

function randomString(length: number, alphanumeric = false) {
  const chars = alphanumeric ? "abcdefghijklmnopqrstuvwxyz0123456789" : "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function generateStatsigId() {
  const msg =
    Math.random() < 0.5
      ? `e:TypeError: Cannot read properties of null (reading 'children["${randomString(5, true)}"]')`
      : `e:TypeError: Cannot read properties of undefined (reading '${randomString(10)}')`;
  return Buffer.from(msg).toString("base64");
}

function randomHex(bytes: number) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function flattenOpenAiMessagesForGrok(messages: any[]): string {
  const extracted: Array<{ role: string; text: string }> = [];
  for (const msg of messages ?? []) {
    let role = String(msg?.role || "user");
    if (role === "developer") role = "system";
    let content = "";
    if (typeof msg?.content === "string") content = msg.content;
    else if (Array.isArray(msg?.content)) {
      content = msg.content
        .filter((c: any) => c?.type === "text")
        .map((c: any) => String(c.text || ""))
        .join(" ");
    }
    if (!content.trim()) continue;
    extracted.push({ role, text: content });
  }

  let lastUserIdx = -1;
  for (let i = extracted.length - 1; i >= 0; i--) {
    if (extracted[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  return extracted
    .map(({ role, text }, i) => (i === lastUserIdx ? text : `${role}: ${text}`))
    .join("\n\n");
}

function buildGrokHeaders(sso: string): Record<string, string> {
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  return {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Baggage:
      "sentry-environment=production,sentry-release=d6add6fb0460641fd482d767a335ef72b9b6abb8,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c",
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
    Origin: "https://grok.com",
    Pragma: "no-cache",
    Referer: "https://grok.com/",
    "Sec-Ch-Ua": '"Google Chrome";v="136", "Chromium";v="136", "Not(A:Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": GROK_USER_AGENT,
    "x-statsig-id": generateStatsigId(),
    "x-xai-request-id": crypto.randomUUID(),
    traceparent: `00-${traceId}-${spanId}-00`,
    Cookie: `sso=${sso}`
  };
}

function buildGrokPayload(model: string, message: string) {
  const mapped = GROK_WEB_MODEL_MAP[model] ?? GROK_WEB_MODEL_MAP["grok-4.1-fast"];
  return {
    temporary: true,
    modelName: mapped.grokModel,
    modelMode: mapped.modelMode,
    message,
    fileAttachments: [],
    imageAttachments: [],
    disableSearch: false,
    enableImageGeneration: false,
    returnImageBytes: false,
    returnRawGrokInXaiRequest: false,
    enableImageStreaming: false,
    imageGenerationCount: 0,
    forceConcise: false,
    toolOverrides: {},
    enableSideBySide: true,
    sendFinalMetadata: true,
    isReasoning: mapped.isThinking,
    disableTextFollowUps: false,
    disableMemory: true,
    forceSideBySide: false,
    isAsyncChat: false,
    disableSelfHarmShortCircuit: false,
    deviceEnvInfo: {
      darkModeEnabled: false,
      devicePixelRatio: 2,
      screenWidth: 2056,
      screenHeight: 1329,
      viewportWidth: 2056,
      viewportHeight: 1083
    }
  };
}

async function* readGrokNdjsonEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const idx = buffer.indexOf("\n");
        if (idx < 0) break;
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          yield JSON.parse(line);
        } catch {
          /* skip partial */
        }
      }
    }
    const remaining = (buffer + decoder.decode()).trim();
    if (remaining) {
      try {
        yield JSON.parse(remaining);
      } catch {
        /* skip */
      }
    }
  } finally {
    reader.releaseLock();
  }
}

type GrokChunk = {
  delta?: string;
  thinking?: string;
  fullMessage?: string;
  fingerprint?: string;
  error?: string;
  done?: boolean;
};

async function* extractContent(eventStream: ReadableStream<Uint8Array>, isThinkingModel: boolean): AsyncGenerator<GrokChunk> {
  let fingerprint = "";
  let thinkOpened = false;

  for await (const event of readGrokNdjsonEvents(eventStream)) {
    if (event?.error) {
      yield { error: event.error.message || `Grok error: ${event.error.code}`, done: true };
      return;
    }
    const resp = event?.result?.response;
    if (!resp) continue;

    if (resp.llmInfo?.modelHash && !fingerprint) fingerprint = resp.llmInfo.modelHash;

    if (resp.modelResponse) {
      const mr = resp.modelResponse;
      if (thinkOpened && isThinkingModel) {
        if (mr.message) yield { thinking: mr.message };
        thinkOpened = false;
      }
      if (mr.message) yield { fullMessage: mr.message, fingerprint };
      if (mr.metadata?.llm_info?.modelHash) fingerprint = mr.metadata.llm_info.modelHash;
      continue;
    }

    if (resp.token != null) {
      if (isThinkingModel && !thinkOpened && typeof resp.token === "string") thinkOpened = true;
      yield { delta: String(resp.token), fingerprint };
    }
  }
  yield { done: true, fingerprint };
}

function sseEncode(payload: object) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function ndjsonToOpenAiSse(eventStream: ReadableStream<Uint8Array>, model: string, isThinkingModel: boolean) {
  const encoder = new TextEncoder();
  const cid = `chatcmpl-grok-${crypto.randomUUID().slice(0, 12)}`;
  const created = Math.floor(Date.now() / 1000);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            sseEncode({
              id: cid,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }]
            })
          )
        );

        let fp = "";
        for await (const chunk of extractContent(eventStream, isThinkingModel)) {
          if (chunk.fingerprint) fp = chunk.fingerprint;
          if (chunk.error) {
            controller.enqueue(
              encoder.encode(
                sseEncode({
                  id: cid,
                  object: "chat.completion.chunk",
                  created,
                  model,
                  system_fingerprint: fp || null,
                  choices: [{ index: 0, delta: { content: `[Error: ${chunk.error}]` }, finish_reason: null }]
                })
              )
            );
            break;
          }
          if (chunk.thinking) {
            controller.enqueue(
              encoder.encode(
                sseEncode({
                  id: cid,
                  object: "chat.completion.chunk",
                  created,
                  model,
                  system_fingerprint: fp || null,
                  choices: [{ index: 0, delta: { reasoning_content: chunk.thinking }, finish_reason: null }]
                })
              )
            );
            continue;
          }
          if (chunk.done) break;
          if (chunk.delta) {
            controller.enqueue(
              encoder.encode(
                sseEncode({
                  id: cid,
                  object: "chat.completion.chunk",
                  created,
                  model,
                  system_fingerprint: fp || null,
                  choices: [{ index: 0, delta: { content: chunk.delta }, finish_reason: null }]
                })
              )
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            sseEncode({
              id: cid,
              object: "chat.completion.chunk",
              created,
              model,
              system_fingerprint: fp || null,
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
            })
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            sseEncode({
              id: cid,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [{ index: 0, delta: { content: `[Stream error: ${message}]` }, finish_reason: "stop" }]
            })
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    }
  });
}

async function ndjsonToOpenAiJson(eventStream: ReadableStream<Uint8Array>, model: string, isThinkingModel: boolean) {
  let fullContent = "";
  let fingerprint = "";
  const thinkingParts: string[] = [];

  for await (const chunk of extractContent(eventStream, isThinkingModel)) {
    if (chunk.fingerprint) fingerprint = chunk.fingerprint;
    if (chunk.error) throw new UpstreamProviderError(chunk.error, 502);
    if (chunk.thinking) {
      thinkingParts.push(chunk.thinking);
      continue;
    }
    if (chunk.done) break;
    if (chunk.fullMessage) fullContent = chunk.fullMessage;
    else if (chunk.delta) fullContent += chunk.delta;
  }

  const message: Record<string, unknown> = { role: "assistant", content: fullContent };
  if (thinkingParts.length) message.reasoning_content = thinkingParts.join("\n");

  const approx = Math.ceil(fullContent.length / 4);
  return {
    id: `chatcmpl-grok-${crypto.randomUUID().slice(0, 12)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    system_fingerprint: fingerprint || null,
    choices: [{ index: 0, message, finish_reason: "stop" }],
    usage: { prompt_tokens: approx, completion_tokens: approx, total_tokens: approx * 2 }
  };
}

/**
 * Grok Web — browser SSO cookie (`sso`) against grok.com chat API (not api.x.ai / Grok CLI).
 */
export class GrokWebExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const sso = normalizeGrokSsoCookie(apiKey ?? provider.apiKey);
    if (!sso) {
      throw new UpstreamProviderError(
        `${provider.name}: paste the grok.com SSO cookie (DevTools → Application → Cookies → sso).`,
        401
      );
    }

    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new UpstreamProviderError("Missing or empty messages array.", 400);
    }

    const message = flattenOpenAiMessagesForGrok(messages);
    if (!message.trim()) throw new UpstreamProviderError("Empty query after processing messages.", 400);

    const model = provider.model || body?.model || "grok-4.1-fast";
    const mapped = GROK_WEB_MODEL_MAP[model] ?? GROK_WEB_MODEL_MAP["grok-4.1-fast"];
    const payload = buildGrokPayload(model, message);
    const headers = buildGrokHeaders(sso);

    const response = await proxyFetch(provider, GROK_CHAT_API, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new UpstreamProviderError(
          "Grok auth failed — SSO cookie may be expired. Re-paste sso from grok.com.",
          response.status
        );
      }
      if (response.status === 429) {
        throw new UpstreamProviderError("Grok rate limited. Wait or rotate cookies.", 429);
      }
      throw await upstreamError(provider, response);
    }
    if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no body.`, 502);

    if (body?.stream) return ndjsonToOpenAiSse(response.body, model, mapped.isThinking);
    return ndjsonToOpenAiJson(response.body, model, mapped.isThinking);
  }

  async listModels(provider: ProviderConfig) {
    if (provider.models?.length) return [...provider.models];
    return Object.keys(GROK_WEB_MODEL_MAP);
  }

  async validate(provider: ProviderConfig) {
    const sso = normalizeGrokSsoCookie(provider.apiKey);
    if (!sso) throw new UpstreamProviderError("Missing grok.com SSO cookie.", 401);
    const headers = buildGrokHeaders(sso);
    const payload = buildGrokPayload(provider.model || "grok-4.1-fast", "Reply with OK.");
    const response = await proxyFetch(provider, GROK_CHAT_API, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (response.status === 401 || response.status === 403) {
      throw new UpstreamProviderError("SSO cookie rejected by grok.com.", response.status);
    }
    // 200 / 400 / 429 usually mean cookie was accepted enough to reach the app.
    if (response.status >= 500) throw await upstreamError(provider, response);
    return {
      models: await this.listModels(provider),
      message: "Grok Web SSO cookie accepted."
    };
  }
}
