import zlib from "node:zlib";
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

function openaiMessagesToCursor(body: any): Array<{ role: string; content: string }> {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const systems: string[] = [];
  const out: Array<{ role: string; content: string }> = [];
  for (const message of messages) {
    const content = textFromContent(message?.content);
    if (message?.role === "system") {
      if (content) systems.push(content);
      continue;
    }
    const role = message?.role === "assistant" ? "assistant" : "user";
    if (!content && role !== "assistant") continue;
    out.push({ role, content: content || "" });
  }
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

function readFrames(buffer: Buffer): Uint8Array[] {
  const frames: Uint8Array[] = [];
  let offset = 0;
  while (offset + 5 <= buffer.length) {
    const flags = buffer[offset];
    const length = buffer.readUInt32BE(offset + 1);
    if (offset + 5 + length > buffer.length) break;
    const payload = decompressPayload(buffer.subarray(offset + 5, offset + 5 + length), flags);
    frames.push(new Uint8Array(payload));
    offset += 5 + length;
  }
  return frames;
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

function protobufToOpenAiSse(buffer: Buffer, model: string): ReadableStream<Uint8Array> {
  const frames = readFrames(buffer);
  let content = "";
  let thinking = "";
  const toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];

  for (const frame of frames) {
    if (frame[0] === 0x7b) {
      try {
        const text = Buffer.from(frame).toString("utf8");
        if (text.includes('"error"') && !content && toolCalls.length === 0) {
          throw new UpstreamProviderError(`Cursor: ${text.slice(0, 400)}`, 429);
        }
      } catch (error) {
        if (error instanceof UpstreamProviderError) throw error;
      }
      continue;
    }
    const result = extractTextFromResponse(frame);
    if (result?.error && !content) throw new UpstreamProviderError(String(result.error), 429);
    if (result?.thinking) thinking += result.thinking;
    if (result?.text) content += result.text;
    if (result?.toolCall) {
      const tc = result.toolCall;
      const existing = toolCalls.find((item) => item.id === tc.id);
      if (existing) existing.function.arguments += tc.function?.arguments ?? "";
      else {
        toolCalls.push({
          id: tc.id,
          type: "function",
          function: { name: tc.function?.name ?? "tool", arguments: tc.function?.arguments ?? "" }
        });
      }
    }
  }

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk(model, { role: "assistant", content: "" }))}\n\n`));
      if (thinking) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk(model, { reasoning_content: thinking }))}\n\n`));
      }
      if (content) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk(model, { content }))}\n\n`));
      }
      if (toolCalls.length) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify(
              sseChunk(model, {
                tool_calls: toolCalls.map((tc, index) => ({
                  index,
                  id: tc.id,
                  type: "function",
                  function: tc.function
                }))
              })
            )}\n\n`
          )
        );
      }
      const finish = toolCalls.length ? "tool_calls" : "stop";
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk(model, {}, finish))}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });
}

function protobufToOpenAiJson(buffer: Buffer, model: string) {
  const frames = readFrames(buffer);
  let content = "";
  let thinking = "";
  const toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];

  for (const frame of frames) {
    if (frame[0] === 0x7b) continue;
    const result = extractTextFromResponse(frame);
    if (result?.thinking) thinking += result.thinking;
    if (result?.text) content += result.text;
    if (result?.toolCall) {
      const tc = result.toolCall;
      const existing = toolCalls.find((item) => item.id === tc.id);
      if (existing) existing.function.arguments += tc.function?.arguments ?? "";
      else {
        toolCalls.push({
          id: tc.id,
          type: "function",
          function: { name: tc.function?.name ?? "tool", arguments: tc.function?.arguments ?? "" }
        });
      }
    }
  }

  const message: any = { role: "assistant", content: content || null };
  if (thinking) message.reasoning_content = thinking;
  if (toolCalls.length) message.tool_calls = toolCalls;

  return {
    id: `chatcmpl-cursor-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: toolCalls.length ? "tool_calls" : "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
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
    const headers = buildCursorHeaders(token, machineId ?? null, true);

    const response = await proxyFetch(provider, endpoint, {
      method: "POST",
      headers,
      body: framed
    });
    if (!response.ok) throw await upstreamError(provider, response);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (body?.stream) return protobufToOpenAiSse(buffer, model);
    return protobufToOpenAiJson(buffer, model);
  }

  async listModels(provider: ProviderConfig) {
    return provider.models?.length ? provider.models : DEFAULT_MODELS;
  }

  async validate(provider: ProviderConfig) {
    const token = cleanApiKey(provider.oauthAccessToken || provider.apiKey || "");
    if (!token) throw new UpstreamProviderError(`${provider.name} needs a Cursor access token.`, 400);
    if (token.length < 50) throw new UpstreamProviderError("Cursor token looks too short.", 400);
    return {
      models: await this.listModels(provider),
      message: provider.oauthMachineId
        ? "Cursor token + machine id saved. Chat will validate against api2.cursor.sh."
        : "Cursor token saved. Add machine id from state.vscdb for best results."
    };
  }
}
