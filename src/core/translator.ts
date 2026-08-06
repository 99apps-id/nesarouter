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

  const toolChoice = mapClaudeToolChoiceToOpenAi(body?.tool_choice);

  return {
    model: body?.model ?? "auto",
    messages,
    ...(body?.max_tokens ? { max_tokens: body.max_tokens } : {}),
    ...(typeof body?.temperature === "number" ? { temperature: body.temperature } : {}),
    ...(typeof body?.top_p === "number" ? { top_p: body.top_p } : {}),
    ...(tools ? { tools } : {}),
    ...(toolChoice !== undefined ? { tool_choice: toolChoice } : {}),
    ...(body?.stream ? { stream: true, stream_options: { include_usage: true } } : {})
  };
}

/** Map Anthropic Messages `tool_choice` → OpenAI chat form. */
export function mapClaudeToolChoiceToOpenAi(toolChoice: unknown): unknown {
  if (toolChoice == null) return undefined;
  if (typeof toolChoice === "string") {
    if (toolChoice === "any") return "required";
    if (toolChoice === "auto" || toolChoice === "none" || toolChoice === "required") return toolChoice;
    return toolChoice;
  }
  if (typeof toolChoice === "object" && toolChoice !== null) {
    const obj = toolChoice as { type?: string; name?: string; function?: { name?: string } };
    if (obj.type === "auto") return "auto";
    if (obj.type === "none") return "none";
    if (obj.type === "any") return "required";
    const name = obj.name ?? obj.function?.name;
    if ((obj.type === "tool" || obj.type === "function") && typeof name === "string" && name) {
      return { type: "function", function: { name } };
    }
  }
  return toolChoice;
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
  let textBlockIndex: number | null = null;
  const toolBlocks = new Map<number, number>();
  let nextBlockIndex = 0;
  let stopReason = "end_turn";
  let usage = { input_tokens: 0, output_tokens: 0 };

  const emit = (event: string, data: any) =>
    textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  return openAiSse.pipeThrough(
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
              textBlockIndex = nextBlockIndex++;
              controller.enqueue(emit("content_block_start", {
                type: "content_block_start",
                index: textBlockIndex,
                content_block: { type: "text", text: "" }
              }));
            }
            controller.enqueue(emit("content_block_delta", {
              type: "content_block_delta",
              index: textBlockIndex ?? 0,
              delta: { type: "text_delta", text: delta.content }
            }));
          }
          if (Array.isArray(delta?.tool_calls)) {
            for (const call of delta.tool_calls) {
              const callIndex = Number.isInteger(call?.index) ? call.index : 0;
              let blockIndex = toolBlocks.get(callIndex);
              if (call?.id && blockIndex === undefined) {
                if (blockOpen && textBlockIndex != null) {
                  controller.enqueue(emit("content_block_stop", { type: "content_block_stop", index: textBlockIndex }));
                  blockOpen = false;
                }
                blockIndex = nextBlockIndex++;
                toolBlocks.set(callIndex, blockIndex);
                controller.enqueue(emit("content_block_start", {
                  type: "content_block_start",
                  index: blockIndex,
                  content_block: { type: "tool_use", id: call.id, name: call?.function?.name, input: {} }
                }));
              }
              if (call?.function?.arguments && blockIndex !== undefined) {
                controller.enqueue(emit("content_block_delta", {
                  type: "content_block_delta",
                  index: blockIndex,
                  delta: { type: "input_json_delta", partial_json: call.function.arguments }
                }));
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
        if (blockOpen && textBlockIndex != null) {
          controller.enqueue(emit("content_block_stop", { type: "content_block_stop", index: textBlockIndex }));
        }
        for (const blockIndex of toolBlocks.values()) {
          controller.enqueue(emit("content_block_stop", { type: "content_block_stop", index: blockIndex }));
        }
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
      if (item.type === "function_call_output") {
        messages.push({ role: "tool", tool_call_id: item.call_id, content: typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? "") });
        continue;
      }
      if (item.type === "function_call") {
        messages.push({ role: "assistant", content: null, tool_calls: [{ id: item.call_id, type: "function", function: { name: item.name, arguments: item.arguments ?? "{}" } }] });
        continue;
      }
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
    ...(Array.isArray(body?.tools) ? { tools: body.tools.map((tool: any) => tool?.function ? tool : { type: "function", function: { name: tool?.name, description: tool?.description, parameters: tool?.parameters ?? {} } }) } : {}),
    ...(body?.tool_choice !== undefined ? { tool_choice: mapResponsesToolChoiceToOpenAi(body.tool_choice) } : {}),
    ...(body?.stream ? { stream: true, stream_options: { include_usage: true } } : {})
  };
}

/** Map Responses API `tool_choice` → OpenAI chat form. */
export function mapResponsesToolChoiceToOpenAi(toolChoice: unknown): unknown {
  if (toolChoice == null) return undefined;
  if (typeof toolChoice === "string") return toolChoice;
  if (typeof toolChoice === "object" && toolChoice !== null) {
    const obj = toolChoice as { type?: string; name?: string; function?: { name?: string } };
    if (obj.type === "function") {
      const name = obj.name ?? obj.function?.name;
      if (typeof name === "string" && name) return { type: "function", function: { name } };
    }
  }
  return toolChoice;
}

/* --------------------------- OpenAI -> Responses --------------------------- */

export function openAiToResponses(payload: any, model: string) {
  const choice = payload?.choices?.[0];
  const text = choice?.message?.content ?? "";
  const output: any[] = [];
  if (text) output.push({ type: "message", role: "assistant", content: [{ type: "output_text", text }] });
  for (const call of choice?.message?.tool_calls ?? []) {
    output.push({ type: "function_call", call_id: call.id, name: call.function?.name, arguments: call.function?.arguments ?? "{}", status: "completed" });
  }
  return {
    id: payload?.id ?? `resp_${Date.now()}`,
    object: "response",
    created_at: payload?.created ?? Math.floor(Date.now() / 1000),
    model,
    status: "completed",
    output,
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
  let fullText = "";
  const toolCalls = new Map<number, { call_id: string; name: string; arguments: string }>();
  let textStarted = false;
  let textDone = false;
  let nextOutputIndex = 0;
  const textOutputIndex = 0;

  const emit = (event: string, data: any) =>
    textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const ensureStarted = (controller: TransformStreamDefaultController<Uint8Array>, parsed: any) => {
    if (started) return;
    started = true;
    if (parsed?.usage?.prompt_tokens) usage.input_tokens = parsed.usage.prompt_tokens;
    controller.enqueue(emit("response.created", {
      type: "response.created",
      response: { id: responseId, object: "response", status: "in_progress", model, output: [] }
    }));
  };

  const ensureTextStarted = (controller: TransformStreamDefaultController<Uint8Array>) => {
    if (textStarted) return;
    textStarted = true;
    nextOutputIndex = Math.max(nextOutputIndex, 1);
    controller.enqueue(emit("response.output_text.started", {
      type: "response.output_text.started",
      response_id: responseId,
      item_id: "msg_0",
      output_index: textOutputIndex,
      content_index: 0
    }));
  };

  return openAiSse.pipeThrough(
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
          if (!dataLine || dataLine === "[DONE]") continue;
          let parsed: any;
          try { parsed = JSON.parse(dataLine); } catch { continue; }

          ensureStarted(controller, parsed);

          const delta = parsed?.choices?.[0]?.delta;
          if (delta?.content) {
            ensureTextStarted(controller);
            fullText += delta.content;
            controller.enqueue(emit("response.output_text.delta", {
              type: "response.output_text.delta",
              response_id: responseId,
              item_id: "msg_0",
              output_index: textOutputIndex,
              content_index: 0,
              delta: delta.content
            }));
          }

          if (Array.isArray(delta?.tool_calls)) {
            for (const call of delta.tool_calls) {
              const index = Number(call?.index ?? 0);
              const current = toolCalls.get(index) ?? {
                call_id: typeof call?.id === "string" && call.id ? call.id : `call_${index}`,
                name: "",
                arguments: ""
              };
              if (typeof call?.id === "string" && call.id) current.call_id = call.id;
              if (typeof call?.function?.name === "string" && call.function.name) {
                if (!current.name) {
                  current.name = call.function.name;
                  const outputIndex = textStarted ? nextOutputIndex++ : index + (fullText ? 1 : 0);
                  controller.enqueue(emit("response.output_item.added", {
                    type: "response.output_item.added",
                    response_id: responseId,
                    output_index: outputIndex,
                    item: {
                      type: "function_call",
                      id: `fc_${current.call_id}`,
                      call_id: current.call_id,
                      name: current.name,
                      arguments: "",
                      status: "in_progress"
                    }
                  }));
                  (current as any)._outputIndex = outputIndex;
                } else {
                  current.name = call.function.name;
                }
              }
              if (typeof call?.function?.arguments === "string" && call.function.arguments) {
                current.arguments += call.function.arguments;
                const outputIndex = (current as any)._outputIndex ?? index;
                controller.enqueue(emit("response.function_call_arguments.delta", {
                  type: "response.function_call_arguments.delta",
                  response_id: responseId,
                  item_id: `fc_${current.call_id}`,
                  output_index: outputIndex,
                  delta: call.function.arguments
                }));
              }
              toolCalls.set(index, current);
            }
          }

          if (parsed?.usage?.completion_tokens) usage.output_tokens = parsed.usage.completion_tokens;
        }
      },
      flush(controller) {
        if (!started) return;
        if (textStarted && !textDone) {
          textDone = true;
          controller.enqueue(emit("response.output_text.done", {
            type: "response.output_text.done",
            response_id: responseId,
            item_id: "msg_0",
            output_index: textOutputIndex,
            content_index: 0,
            text: fullText
          }));
        }
        const output: any[] = [];
        if (fullText) {
          output.push({
            type: "message",
            id: "msg_0",
            role: "assistant",
            content: [{ type: "output_text", text: fullText }]
          });
        }
        for (const [index, call] of [...toolCalls.entries()].sort(([a], [b]) => a - b)) {
          const outputIndex = (call as any)._outputIndex ?? index;
          controller.enqueue(emit("response.function_call_arguments.done", {
            type: "response.function_call_arguments.done",
            response_id: responseId,
            item_id: `fc_${call.call_id}`,
            output_index: outputIndex,
            arguments: call.arguments
          }));
          controller.enqueue(emit("response.output_item.done", {
            type: "response.output_item.done",
            response_id: responseId,
            output_index: outputIndex,
            item: {
              type: "function_call",
              id: `fc_${call.call_id}`,
              call_id: call.call_id,
              name: call.name,
              arguments: call.arguments,
              status: "completed"
            }
          }));
          output.push({
            type: "function_call",
            id: `fc_${call.call_id}`,
            call_id: call.call_id,
            name: call.name,
            arguments: call.arguments,
            status: "completed"
          });
        }
        controller.enqueue(emit("response.completed", {
          type: "response.completed",
          response: {
            id: responseId,
            object: "response",
            status: "completed",
            model,
            output,
            usage: {
              input_tokens: usage.input_tokens,
              output_tokens: usage.output_tokens,
              total_tokens: usage.input_tokens + usage.output_tokens
            }
          }
        }));
      }
    })
  );
}
