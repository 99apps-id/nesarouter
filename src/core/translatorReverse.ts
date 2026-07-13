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

  for (const message of body?.messages ?? []) {
    if (message?.role === "system") {
      const text = typeof message.content === "string"
        ? message.content
        : openAiPartsToClaudeBlocks(message.content).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      if (text) systemText += (systemText ? "\n" : "") + text;
      continue;
    }
    if (message?.role === "tool") {
      messages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: message.tool_call_id,
          content: openAiToolContentToClaude(message.content)
        }]
      });
      continue;
    }
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

  const tools = Array.isArray(body?.tools)
    ? body.tools.map((tool: any) => ({
        name: tool?.function?.name,
        description: tool?.function?.description,
        input_schema: tool?.function?.parameters ?? { type: "object", properties: {} }
      }))
    : undefined;

  return {
    model: body?.model ?? "claude-sonnet-5",
    messages,
    ...(systemText ? { system: systemText } : {}),
    max_tokens: body?.max_tokens ?? 1024,
    ...(typeof body?.temperature === "number" ? { temperature: body.temperature } : {}),
    ...(typeof body?.top_p === "number" ? { top_p: body.top_p } : {}),
    ...(tools ? { tools } : {}),
    ...(body?.stream ? { stream: true } : {})
  };
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

  const emit = (obj: any) => textEncoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  return claudeSse.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += textDecoder.decode(chunk, { stream: true });
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
              choices: [{ index: 0, delta: { tool_calls: [{ index: toolIndex, id: toolCallId, type: "function", function: { name: toolName, arguments: "" } }] }, finish_reason: null }]
            }));
          }
          if (parsed?.type === "content_block_delta") {
            if (parsed?.delta?.type === "text_delta") {
              controller.enqueue(emit({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { content: parsed.delta.text }, finish_reason: null }] }));
            } else if (parsed?.delta?.type === "input_json_delta" && toolIndex >= 0) {
              controller.enqueue(emit({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { tool_calls: [{ index: toolIndex, function: { arguments: parsed.delta.partial_json } }] }, finish_reason: null }] }));
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

export function openAiChatToResponsesRequest(body: any): any {
  let instructions: string | undefined;
  const input: any[] = [];
  for (const message of body?.messages ?? []) {
    if (message?.role === "system") {
      if (typeof message.content === "string") instructions = (instructions ? `${instructions}\n` : "") + message.content;
      continue;
    }
    const text = typeof message?.content === "string" ? message.content : Array.isArray(message?.content) ? message.content.map((p: any) => p?.text ?? "").join("\n") : "";
    if (text) input.push({ role: message?.role === "assistant" ? "assistant" : "user", content: text });
  }
  return {
    model: body?.model ?? "gpt-5.6-sol",
    input,
    ...(instructions ? { instructions } : {}),
    ...(body?.max_tokens ? { max_output_tokens: body.max_tokens } : {}),
    ...(typeof body?.temperature === "number" ? { temperature: body.temperature } : {}),
    ...(body?.stream ? { stream: true } : {})
  };
}

/* ----------------------- Responses response -> OpenAI chat ----------------- */

export function responsesResponseToOpenAi(payload: any, model: string): any {
  const out = Array.isArray(payload?.output) ? payload.output : [];
  let text = "";
  for (const item of out) {
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
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens }
  };
}

/* ----------------------- Responses SSE -> OpenAI SSE ----------------------- */

export function responsesSseToOpenAiSse(responsesSse: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  let buffer = "";
  let usage = { prompt_tokens: 0, completion_tokens: 0 };

  const emit = (obj: any) => textEncoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  return responsesSse.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += textDecoder.decode(chunk, { stream: true });
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
            controller.enqueue(emit({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { content: parsed.delta }, finish_reason: null }] }));
          }
          if (parsed?.type === "response.completed" && parsed?.response?.usage) {
            usage.prompt_tokens = parsed.response.usage.input_tokens ?? 0;
            usage.completion_tokens = parsed.response.usage.output_tokens ?? 0;
            controller.enqueue(emit({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage }));
          }
        }
      },
      flush(controller) {
        controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
      }
    })
  );
}
