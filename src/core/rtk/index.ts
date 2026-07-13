/**
 * RTK (full): compress tool_result / tool message content before upstream.
 * Port of 9router's filter pipeline: auto-detect git-diff/status/log, grep,
 * find, ls, tree, build output, search-list, read-numbered, dedup-log,
 * smart-truncate. Safe by design — never enlarge, never empty, skip errors.
 */

import { MIN_COMPRESS_SIZE, RAW_CAP } from "./constants";
import { autoDetectFilter } from "./autodetect";
import { safeApply } from "./applyFilter";
import { smartTruncate } from "./filters/smartTruncate";

export interface RtkResult {
  body: any;
  savedChars: number;
  hits?: Array<{ shape: string; filter: string; saved: number }>;
}

function compressText(text: string, hits: NonNullable<RtkResult["hits"]>, shape: string): string {
  if (typeof text !== "string") return text;
  const bytesIn = text.length;
  if (bytesIn < MIN_COMPRESS_SIZE || bytesIn > RAW_CAP) return text;

  const tryFilter = (fn: ((input: string) => string) | null | undefined, label?: string) => {
    if (!fn) return null;
    const out = safeApply(fn, text);
    if (!out || out.length === 0 || out.length >= bytesIn) return null;
    hits.push({
      shape,
      filter: label || (fn as { filterName?: string }).filterName || fn.name || "filter",
      saved: bytesIn - out.length
    });
    return out;
  };

  const detected = autoDetectFilter(text);
  const fromDetect = tryFilter(detected);
  if (fromDetect) return fromDetect;

  // Fallback when typed filters don't shrink (e.g. unique log lines): line-based truncate.
  const fromSmart = tryFilter(smartTruncate, "smart-truncate");
  if (fromSmart) return fromSmart;

  // Char fallback for dense single-line / few-line blobs (RTK-lite behavior).
  if (bytesIn > 4000) {
    const head = text.slice(0, 1500);
    const tail = text.slice(-1500);
    const omitted = bytesIn - 3000;
    const out = `${head}\n\n…[truncated ${omitted} chars]…\n\n${tail}`;
    if (out.length < bytesIn) {
      hits.push({ shape, filter: "char-truncate", saved: bytesIn - out.length });
      return out;
    }
  }

  return text;
}

function compressToolMessageContent(content: unknown, hits: NonNullable<RtkResult["hits"]>, shape: string): unknown {
  if (typeof content === "string") return compressText(content, hits, shape);
  if (!Array.isArray(content)) return content;

  let changed = false;
  const next = content.map((part: any) => {
    if (!part || typeof part !== "object") return part;

    if (part.type === "tool_result") {
      if (part.is_error === true) return part;
      if (typeof part.content === "string") {
        const compressed = compressText(part.content, hits, `${shape}-tool_result`);
        if (compressed !== part.content) {
          changed = true;
          return { ...part, content: compressed };
        }
      } else if (Array.isArray(part.content)) {
        let innerChanged = false;
        const inner = part.content.map((block: any) => {
          if (block?.type === "text" && typeof block.text === "string") {
            const compressed = compressText(block.text, hits, `${shape}-tool_result-text`);
            if (compressed !== block.text) {
              innerChanged = true;
              return { ...block, text: compressed };
            }
          }
          return block;
        });
        if (innerChanged) {
          changed = true;
          return { ...part, content: inner };
        }
      }
      return part;
    }

    if (part.type === "text" && typeof part.text === "string") {
      const compressed = compressText(part.text, hits, `${shape}-text`);
      if (compressed !== part.text) {
        changed = true;
        return { ...part, text: compressed };
      }
    }

    return part;
  });

  return changed ? next : content;
}

/**
 * Walk an OpenAI (or Responses) chat body and compress tool-result content.
 */
export function compressToolResults(body: any): RtkResult {
  if (!body) return { body, savedChars: 0 };

  const hits: NonNullable<RtkResult["hits"]> = [];

  // OpenAI chat / Claude-shaped messages
  if (Array.isArray(body.messages)) {
    const nextMessages = body.messages.map((message: any) => {
      if (!message || typeof message !== "object") return message;

      if (message.type === "function_call_output") {
        if (typeof message.output === "string") {
          const compressed = compressText(message.output, hits, "openai-responses-string");
          return compressed !== message.output ? { ...message, output: compressed } : message;
        }
        if (Array.isArray(message.output)) {
          let changed = false;
          const output = message.output.map((part: any) => {
            if (part?.type === "input_text" && typeof part.text === "string") {
              const compressed = compressText(part.text, hits, "openai-responses-array");
              if (compressed !== part.text) {
                changed = true;
                return { ...part, text: compressed };
              }
            }
            return part;
          });
          return changed ? { ...message, output } : message;
        }
        return message;
      }

      if (message.role === "tool") {
        const content = compressToolMessageContent(message.content, hits, "openai-tool");
        return content !== message.content ? { ...message, content } : message;
      }

      if (Array.isArray(message.content)) {
        const content = compressToolMessageContent(message.content, hits, "blocks");
        return content !== message.content ? { ...message, content } : message;
      }

      return message;
    });

    const savedChars = hits.reduce((sum, hit) => sum + hit.saved, 0);
    if (savedChars === 0) return { body, savedChars: 0, hits };
    return { body: { ...body, messages: nextMessages }, savedChars, hits };
  }

  // OpenAI Responses API: body.input
  if (Array.isArray(body.input)) {
    const nextInput = body.input.map((message: any) => {
      if (!message || typeof message !== "object") return message;
      if (message.type === "function_call_output") {
        if (typeof message.output === "string") {
          const compressed = compressText(message.output, hits, "openai-responses-string");
          return compressed !== message.output ? { ...message, output: compressed } : message;
        }
      }
      if (message.role === "tool" && typeof message.content === "string") {
        const compressed = compressText(message.content, hits, "openai-tool");
        return compressed !== message.content ? { ...message, content: compressed } : message;
      }
      return message;
    });
    const savedChars = hits.reduce((sum, hit) => sum + hit.saved, 0);
    if (savedChars === 0) return { body, savedChars: 0, hits };
    return { body: { ...body, input: nextInput }, savedChars, hits };
  }

  return { body, savedChars: 0 };
}
