import zlib from "node:zlib";
import { getPreset } from "@/core/oauthProviderPresets";
import { ProviderConfig } from "@/core/types";
import { buildCursorHeaders } from "@/core/providers/cursorChecksum";
import { extractTextFromResponse, generateCursorBody } from "@/core/providers/cursorProtobuf";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

const encoder = new TextEncoder();

const COMPRESS = { NONE: 0x00, GZIP: 0x01, TRAILER: 0x02, GZIP_TRAILER: 0x03 } as const;

const DEFAULT_MODELS = [
  "default",
  "claude-4.5-sonnet",
  "claude-4.5-sonnet-thinking",
  "claude-4.5-opus-high",
  "claude-4.6-opus-max",
  "gpt-5.2",
  "gpt-5.3-codex",
  "gemini-3-flash-preview",
  "kimi-k2.5"
];

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: any) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

/** Map OpenAI chat messages into Cursor protobuf message shapes (incl. tools). */
export function openaiMessagesToCursor(body: any): any[] {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const systems: string[] = [];
  const out: any[] = [];
  let pendingToolResults: any[] = [];

  const flushToolResults = () => {
    if (!pendingToolResults.length) return;
    out.push({ role: "assistant", content: "", tool_results: pendingToolResults });
    pendingToolResults = [];
  };

  for (const message of messages) {
    if (message?.role === "system") {
      const content = textFromContent(message?.content);
      if (content) systems.push(content);
      continue;
    }
    if (message?.role === "tool") {
      const content = textFromContent(message?.content);
      pendingToolResults.push({
        tool_call_id: message.tool_call_id,
        content,
        result_content: content,
        tool_name: message.name
      });
      continue;
    }
    flushToolResults();
    if (message?.role === "assistant") {
      const content = textFromContent(message?.content);
      const entry: any = { role: "assistant", content: content || "" };
      if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
        entry.tool_calls = message.tool_calls;
      }
      out.push(entry);
      continue;
    }
    const content = textFromContent(message?.content);
    if (!content) continue;
    out.push({ role: "user", content });
  }
  flushToolResults();

  if (systems.length && out.length) {
    const firstUser = out.find((m) => m.role === "user");
    if (firstUser) firstUser.content = `${systems.join("\n\n")}\n\n${firstUser.content}`;
    else out.unshift({ role: "user", content: systems.join("\n\n") });
  } else if (systems.length && !out.length) {
    out.push({ role: "user", content: systems.join("\n\n") });
  }
  return out.length ? out : [{ role: "user", content: "Hello" }];
}

function decompressPayload(payload: Buffer, flags: number): Buffer {
  if (payload.length > 10 && payload[0] === 0x7b && payload[1] === 0x22) return payload;
  if (flags === COMPRESS.GZIP || flags === COMPRESS.TRAILER || flags === COMPRESS.GZIP_TRAILER) {
    try {
      return zlib.gunzipSync(payload);
    } catch {
      try {
        return zlib.inflateSync(payload);
      } catch {
        try {
          return zlib.inflateRawSync(payload);
        } catch {
          return payload;
        }
      }
    }
  }
  return payload;
}

/** Pull complete Connect frames from a growable buffer. Returns remaining incomplete bytes. */
export function takeCompleteFrames(buffer: Buffer): { frames: Uint8Array[]; remaining: Buffer } {
  const frames: Uint8Array[] = [];
  let offset = 0;
  while (offset + 5 <= buffer.length) {
    const flags = buffer[offset];
    const length = buffer.readUInt32BE(offset + 1);
    if (length < 0 || length > 16 * 1024 * 1024) break;
    if (offset + 5 + length > buffer.length) break;
    const payload = decompressPayload(buffer.subarray(offset + 5, offset + 5 + length), flags);
    frames.push(new Uint8Array(payload));
    offset += 5 + length;
  }
  return { frames, remaining: buffer.subarray(offset) };
}

function readFrames(buffer: Buffer): Uint8Array[] {
  return takeCompleteFrames(buffer).frames;
}

function cursorErrorStatus(text: string): number {
  const lower = text.toLowerCase();
  if (/unauth|invalid.?token|forbidden|not.?authorized|401|machine.?id|checksum|expired/.test(lower)) return 401;
  if (/quota|billing|credit|exhausted|rate.?limit|429|spend|insufficient/.test(lower)) return 429;
  return 502;
}

function throwIfCursorErrorFrame(frame: Uint8Array, hasContent: boolean) {
  if (frame[0] !== 0x7b) return;
  try {
    const text = Buffer.from(frame).toString("utf8");
    if (text.includes('"error"') && !hasContent) {
      throw new UpstreamProviderError(`Cursor: ${text.slice(0, 400)}`, cursorErrorStatus(text));
    }
  } catch (error) {
    if (error instanceof UpstreamProviderError) throw error;
  }
}

function sseChunk(model: string, delta: Record<string, unknown>, finishReason: string | null = null) {
  return {
    id: `chatcmpl-cursor-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }]
  };
}

function applyFrameResult(
  frame: Uint8Array,
  state: {
    content: string;
    thinking: string;
    toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  }
): { textDelta?: string; thinkingDelta?: string; newToolCall?: (typeof state.toolCalls)[number]; toolArgsDelta?: { id: string; args: string } } {
  throwIfCursorErrorFrame(frame, Boolean(state.content) || state.toolCalls.length > 0);
  if (frame[0] === 0x7b) return {};
  const result = extractTextFromResponse(frame);
  if (result?.error && !state.content && !state.toolCalls.length) {
    throw new UpstreamProviderError(String(result.error), cursorErrorStatus(String(result.error)));
  }
  const out: {
    textDelta?: string;
    thinkingDelta?: string;
    newToolCall?: (typeof state.toolCalls)[number];
    toolArgsDelta?: { id: string; args: string };
  } = {};
  if (result?.thinking) {
    state.thinking += result.thinking;
    out.thinkingDelta = result.thinking;
  }
  if (result?.text) {
    state.content += result.text;
    out.textDelta = result.text;
  }
  if (result?.toolCall) {
    const tc = result.toolCall;
    const existing = state.toolCalls.find((item) => item.id === tc.id);
    const args = tc.function?.arguments ?? "";
    if (existing) {
      existing.function.arguments += args;
      if (args) out.toolArgsDelta = { id: tc.id, args };
    } else {
      const entry = {
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function?.name ?? "tool", arguments: args }
      };
      state.toolCalls.push(entry);
      out.newToolCall = entry;
    }
  }
  return out;
}

async function consumeConnectBody(body: ReadableStream<Uint8Array> | null): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.length) chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function connectStreamToOpenAiSse(body: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const state = {
        content: "",
        thinking: "",
        toolCalls: [] as Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>
      };
      let pending = Buffer.alloc(0);
      const reader = body.getReader();
      let roleSent = false;

      const enqueue = (delta: Record<string, unknown>, finishReason: string | null = null) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk(model, delta, finishReason))}\n\n`));
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.length) continue;
          pending = Buffer.concat([pending, Buffer.from(value)]);
          const { frames, remaining } = takeCompleteFrames(pending);
          pending = Buffer.from(remaining);
          for (const frame of frames) {
            const delta = applyFrameResult(frame, state);
            if (!roleSent && (delta.textDelta || delta.thinkingDelta || delta.newToolCall)) {
              enqueue({ role: "assistant", content: "" });
              roleSent = true;
            }
            if (delta.thinkingDelta) enqueue({ reasoning_content: delta.thinkingDelta });
            if (delta.textDelta) enqueue({ content: delta.textDelta });
            if (delta.newToolCall) {
              const index = state.toolCalls.findIndex((t) => t.id === delta.newToolCall!.id);
              enqueue({
                tool_calls: [
                  {
                    index: index < 0 ? state.toolCalls.length - 1 : index,
                    id: delta.newToolCall.id,
                    type: "function",
                    function: {
                      name: delta.newToolCall.function.name,
                      arguments: delta.newToolCall.function.arguments
                    }
                  }
                ]
              });
            } else if (delta.toolArgsDelta) {
              const index = state.toolCalls.findIndex((t) => t.id === delta.toolArgsDelta!.id);
              if (index >= 0) {
                enqueue({
                  tool_calls: [
                    {
                      index,
                      id: delta.toolArgsDelta.id,
                      type: "function",
                      function: { arguments: delta.toolArgsDelta.args }
                    }
                  ]
                });
              }
            }
          }
        }
        if (pending.length) {
          const { frames } = takeCompleteFrames(Buffer.concat([pending, Buffer.alloc(0)]));
          for (const frame of frames) applyFrameResult(frame, state);
        }
        if (!roleSent) enqueue({ role: "assistant", content: "" });
        const finish = state.toolCalls.length ? "tool_calls" : "stop";
        enqueue({}, finish);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
      }
    }
  });
}

function protobufToOpenAiJson(buffer: Buffer, model: string) {
  const frames = readFrames(buffer);
  const state = {
    content: "",
    thinking: "",
    toolCalls: [] as Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>
  };

  for (const frame of frames) {
    applyFrameResult(frame, state);
  }

  const message: any = { role: "assistant", content: state.content || null };
  if (state.thinking) message.reasoning_content = state.thinking;
  if (state.toolCalls.length) message.tool_calls = state.toolCalls;

  return {
    id: `chatcmpl-cursor-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: state.toolCalls.length ? "tool_calls" : "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}

function cursorHeaderOptions(provider: ProviderConfig) {
  const preset = getPreset(provider.oauthProfile);
  return {
    clientVersion: preset?.cursorClientVersion,
    clientType: preset?.cursorClientType
  };
}

/**
 * Cursor IDE subscription executor — ConnectRPC protobuf against api2.cursor.sh.
 * Auth is an imported IDE access token + machine id (checksum).
 */
export class CursorExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? "");
    if (!token) throw new UpstreamProviderError(`${provider.name} has no Cursor access token.`, 401);
    const machineId = provider.oauthMachineId || undefined;
    const model = provider.model || "default";
    const messages = openaiMessagesToCursor(body);
    const tools = Array.isArray(body?.tools) ? body.tools : [];
    const framed = Buffer.from(generateCursorBody(messages, model, tools, body?.reasoning_effort ?? null, false));
    const endpoint = `${baseUrl(provider).replace(/\/$/, "")}/aiserver.v1.ChatService/StreamUnifiedChatWithTools`;
    const headers = buildCursorHeaders(token, machineId ?? null, true, cursorHeaderOptions(provider));

    const response = await proxyFetch(provider, endpoint, {
      method: "POST",
      headers,
      body: framed
    });
    if (!response.ok) throw await upstreamError(provider, response);
    if (!response.body) throw new UpstreamProviderError("Cursor returned an empty body.", 502);

    if (body?.stream) {
      return connectStreamToOpenAiSse(response.body, model);
    }
    const buffer = await consumeConnectBody(response.body);
    return protobufToOpenAiJson(buffer, model);
  }

  async listModels(provider: ProviderConfig) {
    return provider.models?.length ? provider.models : DEFAULT_MODELS;
  }

  async validate(provider: ProviderConfig) {
    const token = cleanApiKey(provider.oauthAccessToken || provider.apiKey || "");
    if (!token) throw new UpstreamProviderError(`${provider.name} needs a Cursor access token.`, 400);
    if (token.length < 50) throw new UpstreamProviderError("Cursor token looks too short.", 400);
    if (!provider.oauthMachineId?.trim()) {
      throw new UpstreamProviderError(
        "Cursor machine id missing. Use Auto-import or paste storage.serviceMachineId from state.vscdb.",
        400
      );
    }
    // Live probe against api2.cursor.sh — same path as chat (non-stream).
    await this.call(provider, {
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 8,
      stream: false
    });
    return {
      models: await this.listModels(provider),
      message: "Cursor token + machine id accepted by api2.cursor.sh."
    };
  }
}
