/**
 * Reverse translators: convert NesaRouter's internal OpenAI chat format into
 * upstream vendor formats (Anthropic Messages, OpenAI Responses) for OAuth
 * subscription providers, and convert vendor responses/SSE back to OpenAI chat.
 *
 * Multimodal: preserve image_url / image blocks (including inside tool results).
 * Agents often send Read(image) results as text placeholder + image parts;
 * flattening those to string drops vision and looks like "see attached images".
 */

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function parseDataUri(url: string): { mimeType: string; base64: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(url);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function openAiImagePartToClaude(part: any): any | null {
  if (!part || typeof part !== "object") return null;
  if (part.type === "image" && part.source) return { type: "image", source: part.source };
  if (part.type === "image_url") {
    const url = typeof part.image_url === "string" ? part.image_url : part.image_url?.url;
    if (typeof url !== "string" || !url) return null;
    const parsed = parseDataUri(url);
    if (parsed) {
      return { type: "image", source: { type: "base64", media_type: parsed.mimeType, data: parsed.base64 } };
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return { type: "image", source: { type: "url", url } };
    }
  }
  return null;
}

/** OpenAI string | content-parts → Claude text/image blocks (not tool_*). */
export function openAiPartsToClaudeBlocks(content: unknown): any[] {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  if (!Array.isArray(content)) return [];
  const blocks: any[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if ((part.type === "text" || part.type === "input_text") && typeof part.text === "string" && part.text) {
      blocks.push({ type: "text", text: part.text });
      continue;
    }
    const image = openAiImagePartToClaude(part);
    if (image) blocks.push(image);
  }
  return blocks;
}

/** Preserve multimodal tool results; collapse pure-text arrays to a string. */
export function openAiToolContentToClaude(content: unknown): string | any[] {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : String(content);
  const blocks = openAiPartsToClaudeBlocks(content);
  if (!blocks.length) return "";
  if (blocks.every((b) => b.type === "text")) {
    return blocks.map((b) => b.text).join("\n");
  }
  return blocks;
}

/* ----------------------- OpenAI chat -> Claude request --------------------- */

export function openAiChatToClaudeRequest(body: any): any {
  const messages: any[] = [];
  let systemText = "";
  /** Anthropic requires consecutive tool_result blocks in a single user message. */
  let pendingToolResults: any[] = [];

  const flushToolResults = () => {
    if (!pendingToolResults.length) return;
    messages.push({ role: "user", content: pendingToolResults });
    pendingToolResults = [];
  };

  for (const message of body?.messages ?? []) {
    if (message?.role === "system") {
      const text = typeof message.content === "string"
        ? message.content
        : openAiPartsToClaudeBlocks(message.content).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      if (text) systemText += (systemText ? "\n" : "") + text;
      continue;
    }
    if (message?.role === "tool") {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: message.tool_call_id,
        content: openAiToolContentToClaude(message.content)
      });
      continue;
    }
    flushToolResults();
    const role = message?.role === "assistant" ? "assistant" : "user";
    const content: any[] = [];
    if (typeof message?.content === "string" && message.content) {
      content.push({ type: "text", text: message.content });
    } else if (Array.isArray(message?.content)) {
      content.push(...openAiPartsToClaudeBlocks(message.content));
    }
    if (Array.isArray(message?.tool_calls)) {
      for (const call of message.tool_calls) {
        let input: any = {};
        try { input = JSON.parse(call?.function?.arguments ?? "{}"); } catch {}
        content.push({ type: "tool_use", id: call?.id, name: call?.function?.name, input });
      }
    }
    if (content.length) messages.push({ role, content });
  }
  flushToolResults();

  const tools = Array.isArray(body?.tools)
    ? body.tools
        .map((tool: any) => ({
          name: tool?.function?.name,
          description: tool?.function?.description,
          input_schema: tool?.function?.parameters ?? { type: "object", properties: {} }
        }))
        .filter((tool: { name?: unknown }) => typeof tool.name === "string" && tool.name)
    : undefined;

  const toolChoice = mapOpenAiToolChoiceToClaude(body?.tool_choice);

  return {
    model: body?.model ?? "claude-sonnet-5",
    messages,
    ...(systemText ? { system: systemText } : {}),
    max_tokens: body?.max_tokens ?? 1024,
    ...(typeof body?.temperature === "number" ? { temperature: body.temperature } : {}),
    ...(typeof body?.top_p === "number" ? { top_p: body.top_p } : {}),
    ...(tools ? { tools } : {}),
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
    ...(body?.stream ? { stream: true } : {})
  };
}

/** Map OpenAI chat `tool_choice` → Anthropic Messages form. */
export function mapOpenAiToolChoiceToClaude(toolChoice: unknown): Record<string, unknown> | undefined {
  if (toolChoice == null) return undefined;
  if (toolChoice === "auto") return { type: "auto" };
  if (toolChoice === "none") return { type: "none" };
  if (toolChoice === "required") return { type: "any" };
  if (typeof toolChoice === "object" && toolChoice !== null) {
    const obj = toolChoice as { type?: string; function?: { name?: string }; name?: string };
    const name = obj.function?.name ?? obj.name;
    if ((obj.type === "function" || obj.type === "tool") && typeof name === "string" && name) {
      return { type: "tool", name };
    }
  }
  return undefined;
}

/* ----------------------- Claude response -> OpenAI chat -------------------- */

export function claudeResponseToOpenAi(payload: any, model: string): any {
  const blocks = Array.isArray(payload?.content) ? payload.content : [];
  let text = "";
  const tool_calls: any[] = [];
  for (const block of blocks) {
    if (block?.type === "text") text += block.text ?? "";
    else if (block?.type === "tool_use") tool_calls.push({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) } });
  }
  const stopMap: Record<string, string> = { end_turn: "stop", max_tokens: "length", tool_use: "tool_calls", stop_sequence: "stop" };
  const inputTokens = payload?.usage?.input_tokens ?? 0;
  const outputTokens = payload?.usage?.output_tokens ?? 0;
  return {
    id: payload?.id ?? `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content: text || null, ...(tool_calls.length ? { tool_calls } : {}) },
      finish_reason: stopMap[payload?.stop_reason] ?? "stop"
    }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens }
  };
}

/* ----------------------- Claude SSE -> OpenAI SSE -------------------------- */

export function claudeSseToOpenAiSse(claudeSse: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  let buffer = "";
  let toolIndex = -1;
  let toolCallId = "";
  let toolName = "";
  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  let roleSent = false;

  const emit = (obj: any) => textEncoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
  const withRole = (delta: Record<string, unknown>) => {
    if (roleSent) return delta;
    roleSent = true;
    return { role: "assistant", ...delta };
  };

  return claudeSse.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += textDecoder.decode(chunk, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");
        if (buffer.length > 16 * 1024 * 1024) throw new Error("Upstream SSE event exceeded 16 MB.");
        let idx = buffer.indexOf("\n\n");
        while (idx >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf("\n\n");
          const dataLine = raw.split(/\r?\n/).find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!dataLine) continue;
          let parsed: any;
          try { parsed = JSON.parse(dataLine); } catch { continue; }

          if (parsed?.type === "message_start" && parsed?.message?.usage) {
            usage.prompt_tokens = parsed.message.usage.input_tokens ?? 0;
          }
          if (parsed?.type === "content_block_start" && parsed?.content_block?.type === "tool_use") {
            toolIndex += 1;
            toolCallId = parsed.content_block.id;
            toolName = parsed.content_block.name;
            controller.enqueue(emit({
              id, object: "chat.completion.chunk", created, model,
              choices: [{
                index: 0,
                delta: withRole({
                  tool_calls: [{ index: toolIndex, id: toolCallId, type: "function", function: { name: toolName, arguments: "" } }]
                }),
                finish_reason: null
              }]
            }));
          }
          if (parsed?.type === "content_block_delta") {
            if (parsed?.delta?.type === "text_delta") {
              controller.enqueue(emit({
                id, object: "chat.completion.chunk", created, model,
                choices: [{ index: 0, delta: withRole({ content: parsed.delta.text }), finish_reason: null }]
              }));
            } else if (parsed?.delta?.type === "input_json_delta" && toolIndex >= 0) {
              controller.enqueue(emit({
                id, object: "chat.completion.chunk", created, model,
                choices: [{ index: 0, delta: { tool_calls: [{ index: toolIndex, function: { arguments: parsed.delta.partial_json } }] }, finish_reason: null }]
              }));
            }
          }
          if (parsed?.type === "message_delta") {
            if (parsed?.usage?.output_tokens) usage.completion_tokens = parsed.usage.output_tokens;
            const stopMap: Record<string, string> = { end_turn: "stop", max_tokens: "length", tool_use: "tool_calls", stop_sequence: "stop" };
            const finish = stopMap[parsed?.delta?.stop_reason] ?? "stop";
            controller.enqueue(emit({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: finish }], usage }));
          }
        }
      },
      flush(controller) {
        controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
      }
    })
  );
}

/* ----------------------- OpenAI chat -> Responses request ------------------ */

const CODEX_UNSUPPORTED_PARAMS = [
  "temperature",
  "top_p",
  "max_output_tokens",
  "max_tokens",
  "metadata",
  "safety_identifier",
  "prompt_cache_retention",
  "truncation",
  "previous_response_id",
  "stream_options"
] as const;

/** Fields ChatGPT Codex /responses accepts (9router-style allowlist). */
const CODEX_RESPONSES_ALLOWLIST = new Set([
  "model",
  "input",
  "instructions",
  "tools",
  "tool_choice",
  "stream",
  "store",
  "reasoning",
  "service_tier",
  "include",
  "prompt_cache_key",
  "text"
]);

const CODEX_DEFAULT_INSTRUCTIONS = "You are a helpful coding assistant.";

function textFromMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: any) => {
      if (typeof part === "string") return part;
      if (typeof part?.text === "string") return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function responsesInputPartsFromContent(content: unknown, role: "user" | "assistant"): any[] {
  if (typeof content === "string") {
    return content ? [{ type: role === "assistant" ? "output_text" : "input_text", text: content }] : [];
  }
  if (!Array.isArray(content)) return [];
  const parts: any[] = [];
  for (const part of content) {
    if (typeof part === "string") {
      if (part) parts.push({ type: role === "assistant" ? "output_text" : "input_text", text: part });
      continue;
    }
    if (typeof part?.text === "string" && part.text) {
      parts.push({ type: role === "assistant" ? "output_text" : "input_text", text: part.text });
      continue;
    }
    const imageUrl = part?.image_url?.url ?? part?.image_url;
    if ((part?.type === "image_url" || part?.image_url) && typeof imageUrl === "string") {
      const dataUrl = imageUrl.match(/^data:([^;]+);base64,(.+)$/i);
      if (dataUrl) {
        parts.push({ type: "input_image", image_url: imageUrl });
      } else {
        parts.push({ type: "input_text", text: `[image: ${imageUrl.slice(0, 200)}]` });
      }
    }
  }
  return parts;
}

function responsesInputContent(text: string, role: "user" | "assistant") {
  return [{ type: role === "assistant" ? "output_text" : "input_text", text }];
}

export function openAiChatToResponsesRequest(body: any, options?: { codex?: boolean }): any {
  const codex = Boolean(options?.codex);
  let instructions: string | undefined;
  const input: any[] = [];
  for (const message of body?.messages ?? []) {
    if (message?.role === "system") {
      const text = textFromMessageContent(message.content);
      if (text) instructions = (instructions ? `${instructions}\n` : "") + text;
      continue;
    }
    if (message?.role === "tool") {
      const text = textFromMessageContent(message.content);
      // Empty string is a valid tool result (successful no-output tools).
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id ?? message.id ?? "tool",
        output: text
      });
      continue;
    }
    const role = message?.role === "assistant" ? "assistant" : "user";
    const text = textFromMessageContent(message?.content);
    const hasTools = Array.isArray(message?.tool_calls) && message.tool_calls.length;
    if (!text && !hasTools) continue;
    if (hasTools && role === "assistant") {
      for (const call of message.tool_calls) {
        input.push({
          type: "function_call",
          call_id: call?.id ?? `call_${call?.function?.name ?? "fn"}`,
          name: call?.function?.name ?? "tool",
          arguments: call?.function?.arguments ?? "{}"
        });
      }
      if (text) {
        input.push({
          type: "message",
          role: "assistant",
          content: responsesInputPartsFromContent(text, "assistant")
        });
      }
    } else {
      const parts = responsesInputPartsFromContent(message?.content, role);
      if (parts.length) input.push({ type: "message", role, content: parts });
    }
  }

  const request: Record<string, unknown> = {
    model: body?.model ?? "gpt-5.6-sol",
    input,
    ...(instructions ? { instructions } : {}),
    ...(body?.stream ? { stream: true } : {})
  };

  if (Array.isArray(body?.tools) && body.tools.length) {
    request.tools = body.tools.map((tool: any) => {
      const fn = tool?.function ?? tool;
      return {
        type: "function",
        name: fn?.name,
        description: fn?.description,
        parameters: fn?.parameters ?? { type: "object", properties: {} }
      };
    });
  }
  if (body?.tool_choice != null) {
    const choice = body.tool_choice;
    request.tool_choice = choice?.type === "function" && choice?.function?.name
      ? { type: "function", name: choice.function.name }
      : choice;
  }

  if (codex) {
    request.store = false;
    request.stream = true;
    if (!instructions?.trim()) request.instructions = CODEX_DEFAULT_INSTRUCTIONS;
    // Never forward sampling / store params ChatGPT Codex rejects.
    for (const key of CODEX_UNSUPPORTED_PARAMS) delete request[key];
    return request;
  }

  if (body?.max_tokens) request.max_output_tokens = body.max_tokens;
  if (typeof body?.temperature === "number") request.temperature = body.temperature;
  return request;
}

/** ChatGPT subscription Codex endpoint — detect by OAuth profile or base URL. */
export function isChatgptCodexUpstream(provider: {
  oauthProfile?: string;
  baseUrl?: string;
  id?: string;
}): boolean {
  if (provider.oauthProfile === "openai_codex") return true;
  if (provider.id === "oauth-chatgpt") return true;
  const url = (provider.baseUrl ?? "").toLowerCase();
  return url.includes("chatgpt.com/backend-api/codex") || url.includes("/codex/responses");
}

/** Force ChatGPT subscription Codex constraints on a Responses-shaped body. */
export function normalizeCodexResponsesRequest(request: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(request)) {
    if (CODEX_RESPONSES_ALLOWLIST.has(key)) next[key] = value;
  }
  // Backend rejects store!=false and non-streaming for ChatGPT-tier OAuth.
  next.store = false;
  next.stream = true;
  if (typeof next.instructions !== "string" || !String(next.instructions).trim()) {
    next.instructions = CODEX_DEFAULT_INSTRUCTIONS;
  }
  for (const key of CODEX_UNSUPPORTED_PARAMS) delete next[key];
  if (next.service_tier === "fast") next.service_tier = "priority";
  if (next.service_tier && next.service_tier !== "priority") delete next.service_tier;
  return next;
}

/* ----------------------- Responses response -> OpenAI chat ----------------- */

export function responsesResponseToOpenAi(payload: any, model: string): any {
  const out = Array.isArray(payload?.output) ? payload.output : [];
  let text = "";
  const toolCalls: any[] = [];
  for (const item of out) {
    if (item?.type === "function_call") {
      toolCalls.push({
        id: item.call_id ?? item.id ?? `call_${toolCalls.length}`,
        type: "function",
        function: { name: item.name ?? "tool", arguments: item.arguments ?? "{}" }
      });
    }
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") text += part.text;
    }
  }
  const inputTokens = payload?.usage?.input_tokens ?? 0;
  const outputTokens = payload?.usage?.output_tokens ?? 0;
  return {
    id: payload?.id ?? `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
      finish_reason: toolCalls.length ? "tool_calls" : "stop"
    }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens }
  };
}

/* ----------------------- Responses SSE -> OpenAI SSE ----------------------- */

export function responsesSseToOpenAiSse(responsesSse: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  let buffer = "";
  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  let sawToolCall = false;
  let sawTextDelta = false;
  const toolArgumentDeltas = new Set<number>();
  /** Map Responses output_index → contiguous OpenAI tool_call index (0..N-1). */
  const toolIndexByOutput = new Map<number, number>();
  let nextToolIndex = 0;
  let roleSent = false;

  const emit = (obj: any) => textEncoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
  const withRole = (delta: Record<string, unknown>) => {
    if (roleSent) return delta;
    roleSent = true;
    return { role: "assistant", ...delta };
  };
  const openAiToolIndex = (outputIndex: number) => {
    let index = toolIndexByOutput.get(outputIndex);
    if (index == null) {
      index = nextToolIndex++;
      toolIndexByOutput.set(outputIndex, index);
    }
    return index;
  };

  return responsesSse.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += textDecoder.decode(chunk, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");
        if (buffer.length > 16 * 1024 * 1024) throw new Error("Upstream SSE event exceeded 16 MB.");
        let idx = buffer.indexOf("\n\n");
        while (idx >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf("\n\n");
          const dataLine = raw.split(/\r?\n/).find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!dataLine) continue;
          let parsed: any;
          try { parsed = JSON.parse(dataLine); } catch { continue; }

          if (parsed?.type === "response.output_text.delta" && typeof parsed?.delta === "string") {
            sawTextDelta = true;
            controller.enqueue(emit({
              id, object: "chat.completion.chunk", created, model,
              choices: [{ index: 0, delta: withRole({ content: parsed.delta }), finish_reason: null }]
            }));
          }
          if (parsed?.type === "response.output_item.added" && parsed?.item?.type === "function_call") {
            sawToolCall = true;
            const index = openAiToolIndex(Number(parsed.output_index ?? 0));
            controller.enqueue(emit({
              id, object: "chat.completion.chunk", created, model,
              choices: [{
                index: 0,
                delta: withRole({
                  tool_calls: [{
                    index,
                    id: parsed.item.call_id ?? parsed.item.id,
                    type: "function",
                    function: { name: parsed.item.name, arguments: "" }
                  }]
                }),
                finish_reason: null
              }]
            }));
          }
          if (parsed?.type === "response.function_call_arguments.delta" && typeof parsed?.delta === "string") {
            sawToolCall = true;
            const index = openAiToolIndex(Number(parsed.output_index ?? 0));
            toolArgumentDeltas.add(index);
            controller.enqueue(emit({
              id, object: "chat.completion.chunk", created, model,
              choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: parsed.delta } }] }, finish_reason: null }]
            }));
          }
          if (parsed?.type === "response.output_item.done") {
            const item = parsed?.item;
            const outputIndex = Number(parsed.output_index ?? 0);
            if (item?.type === "message" && !sawTextDelta) {
              for (const part of item?.content ?? []) {
                if (part?.type === "output_text" && typeof part?.text === "string" && part.text) {
                  sawTextDelta = true;
                  controller.enqueue(emit({
                    id, object: "chat.completion.chunk", created, model,
                    choices: [{ index: 0, delta: withRole({ content: part.text }), finish_reason: null }]
                  }));
                }
              }
            }
            if (item?.type === "function_call") {
              const index = openAiToolIndex(outputIndex);
              if (!toolArgumentDeltas.has(index) && typeof item?.arguments === "string") {
                sawToolCall = true;
                controller.enqueue(emit({
                  id, object: "chat.completion.chunk", created, model,
                  choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: item.arguments } }] }, finish_reason: null }]
                }));
              }
            }
          }
          if (parsed?.type === "response.completed" && parsed?.response?.usage) {
            if (!sawTextDelta && !sawToolCall) {
              for (const item of parsed?.response?.output ?? []) {
                if (item?.type === "message") {
                  for (const part of item?.content ?? []) {
                    if (part?.type === "output_text" && typeof part?.text === "string" && part.text) {
                      sawTextDelta = true;
                      controller.enqueue(emit({
                        id, object: "chat.completion.chunk", created, model,
                        choices: [{ index: 0, delta: withRole({ content: part.text }), finish_reason: null }]
                      }));
                    }
                  }
                }
              }
            }
            usage.prompt_tokens = parsed.response.usage.input_tokens ?? 0;
            usage.completion_tokens = parsed.response.usage.output_tokens ?? 0;
            controller.enqueue(emit({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: sawToolCall ? "tool_calls" : "stop" }], usage }));
          }
        }
      },
      flush(controller) {
        controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
      }
    })
  );
}
