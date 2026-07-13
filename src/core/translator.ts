/**
 * Format translators between OpenAI chat completions (the internal canonical
 * format NesaRouter routes) and the Anthropic Messages / OpenAI Responses
 * wire formats. Preserves text, tool_use/tool_result, and image blocks
 * (including images nested inside tool_result — agent Read(image) path).
 */

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function claudeImageToOpenAiPart(block: any): any | null {
  if (block?.type !== "image" || !block.source) return null;
  if (block.source.type === "base64" && block.source.data) {
    const media = block.source.media_type || "image/png";
    return { type: "image_url", image_url: { url: `data:${media};base64,${block.source.data}` } };
  }
  if (block.source.type === "url" && typeof block.source.url === "string") {
    return { type: "image_url", image_url: { url: block.source.url } };
  }
  return null;
}

/** Claude tool_result content → OpenAI tool content (string or multimodal parts). */
export function claudeToolResultToOpenAiContent(content: unknown): string | any[] {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : String(content);
  const parts: any[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text" && typeof part.text === "string") {
      parts.push({ type: "text", text: part.text });
      continue;
    }
    const image = claudeImageToOpenAiPart(part);
    if (image) parts.push(image);
  }
  if (!parts.length) return "";
  if (parts.every((p) => p.type === "text")) return parts.map((p) => p.text).join("\n");
  return parts;
}

/* ----------------------------- Claude -> OpenAI ---------------------------- */

function claudeContentToOpenAi(content: any): {
  text?: string;
  contentParts?: any[];
  tool_calls?: any[];
  tool_results?: any[];
} {
  if (typeof content === "string") return { text: content };
  if (!Array.isArray(content)) return {};

  let text = "";
  const contentParts: any[] = [];
  let hasImage = false;
  const tool_calls: any[] = [];
  const tool_results: any[] = [];

  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" && typeof block.text === "string") {
      text += (text ? "\n" : "") + block.text;
      contentParts.push({ type: "text", text: block.text });
    } else if (block.type === "image") {
      const image = claudeImageToOpenAiPart(block);
      if (image) {
        hasImage = true;
        contentParts.push(image);
      }
    } else if (block.type === "tool_use") {
      tool_calls.push({
        id: block.id,
        type: "function",
        function: { name: block.name, arguments: typeof block.input === "string" ? block.input : JSON.stringify(block.input ?? {}) }
      });
    } else if (block.type === "tool_result") {
      tool_results.push({
        tool_call_id: block.tool_use_id,
        content: claudeToolResultToOpenAiContent(block.content)
      });
    }
  }

  return {
    text: hasImage ? undefined : text || undefined,
    contentParts: hasImage ? contentParts : undefined,
    tool_calls: tool_calls.length ? tool_calls : undefined,
    tool_results: tool_results.length ? tool_results : undefined
  };
}

export function claudeToOpenAi(body: any): any {
  const messages: any[] = [];
  const system = body?.system;
  if (typeof system === "string" && system.trim()) {
    messages.push({ role: "system", content: system });
  } else if (Array.isArray(system)) {
    const sysText = system.map((part: any) => part?.text ?? "").join("\n").trim();
    if (sysText) messages.push({ role: "system", content: sysText });
  }

  for (const message of body?.messages ?? []) {
    const role = message?.role === "assistant" ? "assistant" : "user";
    const { text, contentParts, tool_calls, tool_results } = claudeContentToOpenAi(message?.content);

    if (tool_results && tool_results.length) {
      for (const result of tool_results) {
        messages.push({ role: "tool", tool_call_id: result.tool_call_id, content: result.content });
      }
    }
    if (contentParts || text || tool_calls) {
      messages.push({
        role,
        ...(contentParts ? { content: contentParts } : text ? { content: text } : { content: null }),
        ...(tool_calls ? { tool_calls } : {})
      });
    }
  }

  const tools = Array.isArray(body?.tools)
    ? body.tools.map((tool: any) => ({
        type: "function",
        function: {
          name: tool?.name,
          description: tool?.description,
          parameters: tool?.input_schema ?? { type: "object", properties: {} }
        }
      }))
    : undefined;

  return {
    model: body?.model ?? "auto",
    messages,
    ...(body?.max_tokens ? { max_tokens: body.max_tokens } : {}),
    ...(typeof body?.temperature === "number" ? { temperature: body.temperature } : {}),
    ...(typeof body?.top_p === "number" ? { top_p: body.top_p } : {}),
    ...(tools ? { tools } : {}),
    ...(body?.tool_choice ? { tool_choice: body.tool_choice } : {}),
    ...(body?.stream ? { stream: true, stream_options: { include_usage: true } } : {})
  };
}

/* ----------------------------- OpenAI -> Claude ---------------------------- */

export function openAiToClaude(payload: any, model: string) {
  const choice = payload?.choices?.[0];
  const message = choice?.message ?? {};
  const content: any[] = [];

  if (typeof message.content === "string" && message.content) {
    content.push({ type: "text", text: message.content });
  }
  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      let input: any = {};
      try { input = JSON.parse(call?.function?.arguments ?? "{}"); } catch {}
      content.push({ type: "tool_use", id: call?.id, name: call?.function?.name, input });
    }
  }

  const stopReasonMap: Record<string, string> = {
    stop: "end_turn",
    length: "max_tokens",
    tool_calls: "tool_use",
    content_filter: "end_turn"
  };
  const stopReason = stopReasonMap[choice?.finish_reason] ?? "end_turn";

  return {
    id: payload?.id ?? `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: payload?.usage?.prompt_tokens ?? 0,
      output_tokens: payload?.usage?.completion_tokens ?? 0
    }
  };
}

/* ----------------------- OpenAI SSE -> Claude SSE -------------------------- */

export function claudeStreamFromOpenAiSse(openAiSse: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  const messageId = `msg_${Date.now()}`;
  let buffer = "";
  let started = false;
  let blockOpen = false;
  let currentToolId: string | null = null;
  let stopReason = "end_turn";
  let usage = { input_tokens: 0, output_tokens: 0 };

  const emit = (event: string, data: any) =>
    textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  return openAiSse.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += textDecoder.decode(chunk, { stream: true });
        let idx = buffer.indexOf("\n\n");
        while (idx >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf("\n\n");
          const dataLine = raw.split(/\r?\n/).find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!dataLine || dataLine === "[DONE]") continue;
          let parsed: any;
          try { parsed = JSON.parse(dataLine); } catch { continue; }

          if (!started) {
            started = true;
            if (parsed?.usage?.prompt_tokens) usage.input_tokens = parsed.usage.prompt_tokens;
            controller.enqueue(emit("message_start", {
              type: "message_start",
              message: { id: messageId, type: "message", role: "assistant", model, content: [], stop_reason: null, usage: { input_tokens: usage.input_tokens, output_tokens: 0 } }
            }));
          }

          const delta = parsed?.choices?.[0]?.delta;
          if (delta?.content) {
            if (!blockOpen) {
              blockOpen = true;
              controller.enqueue(emit("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }));
            }
            controller.enqueue(emit("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: delta.content } }));
          }
          if (Array.isArray(delta?.tool_calls)) {
            for (const call of delta.tool_calls) {
              if (call?.id && !currentToolId) {
                if (blockOpen) controller.enqueue(emit("content_block_stop", { type: "content_block_stop", index: 0 }));
                currentToolId = call.id;
                blockOpen = true;
                controller.enqueue(emit("content_block_start", { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: call.id, name: call?.function?.name, input: {} } }));
              }
              if (call?.function?.arguments) {
                controller.enqueue(emit("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: call.function.arguments } }));
              }
            }
          }
          if (parsed?.usage?.completion_tokens) usage.output_tokens = parsed.usage.completion_tokens;
          if (parsed?.usage?.prompt_tokens) usage.input_tokens = parsed.usage.prompt_tokens;
          const finish = parsed?.choices?.[0]?.finish_reason;
          if (finish) {
            const map: Record<string, string> = { stop: "end_turn", length: "max_tokens", tool_calls: "tool_use", content_filter: "end_turn" };
            stopReason = map[finish] ?? "end_turn";
          }
        }
      },
      flush(controller) {
        if (blockOpen) controller.enqueue(emit("content_block_stop", { type: "content_block_stop", index: currentToolId ? 1 : 0 }));
        if (started) {
          controller.enqueue(emit("message_delta", { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: usage.output_tokens } }));
          controller.enqueue(emit("message_stop", { type: "message_stop" }));
        }
      }
    })
  );
}

/* --------------------------- Responses -> OpenAI --------------------------- */

export function responsesToOpenAi(body: any): any {
  const messages: any[] = [];
  if (typeof body?.instructions === "string" && body.instructions.trim()) {
    messages.push({ role: "system", content: body.instructions });
  }

  const input = body?.input;
  if (typeof input === "string") {
    messages.push({ role: "user", content: input });
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (!item) continue;
      const role = item.role === "assistant" ? "assistant" : "user";
      const text = typeof item.content === "string"
        ? item.content
        : Array.isArray(item.content)
          ? item.content.map((part: any) => part?.text ?? part?.output_text ?? "").join("\n")
          : "";
      if (text) messages.push({ role, content: text });
    }
  }

  return {
    model: body?.model ?? "auto",
    messages,
    ...(body?.max_output_tokens ? { max_tokens: body.max_output_tokens } : {}),
    ...(typeof body?.temperature === "number" ? { temperature: body.temperature } : {}),
    ...(body?.stream ? { stream: true, stream_options: { include_usage: true } } : {})
  };
}

/* --------------------------- OpenAI -> Responses --------------------------- */

export function openAiToResponses(payload: any, model: string) {
  const choice = payload?.choices?.[0];
  const text = choice?.message?.content ?? "";
  return {
    id: payload?.id ?? `resp_${Date.now()}`,
    object: "response",
    created_at: payload?.created ?? Math.floor(Date.now() / 1000),
    model,
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text }]
      }
    ],
    usage: {
      input_tokens: payload?.usage?.prompt_tokens ?? 0,
      output_tokens: payload?.usage?.completion_tokens ?? 0,
      total_tokens: payload?.usage?.total_tokens ?? 0
    }
  };
}

export function responsesStreamFromOpenAiSse(openAiSse: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  const responseId = `resp_${Date.now()}`;
  let buffer = "";
  let started = false;
  let usage = { input_tokens: 0, output_tokens: 0 };

  const emit = (event: string, data: any) =>
    textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  return openAiSse.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += textDecoder.decode(chunk, { stream: true });
        let idx = buffer.indexOf("\n\n");
        while (idx >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf("\n\n");
          const dataLine = raw.split(/\r?\n/).find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!dataLine || dataLine === "[DONE]") continue;
          let parsed: any;
          try { parsed = JSON.parse(dataLine); } catch { continue; }

          if (!started) {
            started = true;
            if (parsed?.usage?.prompt_tokens) usage.input_tokens = parsed.usage.prompt_tokens;
            controller.enqueue(emit("response.created", {
              type: "response.created",
              response: { id: responseId, object: "response", status: "in_progress", model, output: [] }
            }));
            controller.enqueue(emit("response.output_text.started", { type: "response.output_text.started", response_id: responseId, item_id: "msg_0", output_index: 0, content_index: 0 }));
          }

          const delta = parsed?.choices?.[0]?.delta;
          if (delta?.content) {
            controller.enqueue(emit("response.output_text.delta", { type: "response.output_text.delta", response_id: responseId, item_id: "msg_0", output_index: 0, content_index: 0, delta: delta.content }));
          }
          if (parsed?.usage?.completion_tokens) usage.output_tokens = parsed.usage.completion_tokens;
        }
      },
      flush(controller) {
        if (started) {
          controller.enqueue(emit("response.output_text.done", { type: "response.output_text.done", response_id: responseId, item_id: "msg_0", output_index: 0, content_index: 0, text: "" }));
          controller.enqueue(emit("response.completed", {
            type: "response.completed",
            response: { id: responseId, object: "response", status: "completed", model, output: [], usage }
          }));
        }
      }
    })
  );
}
