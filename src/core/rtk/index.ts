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

export interface RtkResult<T = unknown> {
  body: T;
  savedChars: number;
  hits?: Array<{ shape: string; filter: string; saved: number }>;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
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
  const next = content.map((part) => {
    const partRecord = asRecord(part);
    if (!partRecord) return part;

    if (partRecord.type === "tool_result") {
      if (partRecord.is_error === true) return part;
      if (typeof partRecord.content === "string") {
        const compressed = compressText(partRecord.content, hits, `${shape}-tool_result`);
        if (compressed !== partRecord.content) {
          changed = true;
          return { ...partRecord, content: compressed };
        }
      } else if (Array.isArray(partRecord.content)) {
        let innerChanged = false;
        const inner = partRecord.content.map((block) => {
          const blockRecord = asRecord(block);
          if (blockRecord?.type === "text" && typeof blockRecord.text === "string") {
            const compressed = compressText(blockRecord.text, hits, `${shape}-tool_result-text`);
            if (compressed !== blockRecord.text) {
              innerChanged = true;
              return { ...blockRecord, text: compressed };
            }
          }
          return block;
        });
        if (innerChanged) {
          changed = true;
          return { ...partRecord, content: inner };
        }
      }
      return part;
    }

    if (partRecord.type === "text" && typeof partRecord.text === "string") {
      const compressed = compressText(partRecord.text, hits, `${shape}-text`);
      if (compressed !== partRecord.text) {
        changed = true;
        return { ...partRecord, text: compressed };
      }
    }

    return part;
  });

  return changed ? next : content;
}

/**
 * Walk an OpenAI (or Responses) chat body and compress tool-result content.
 */
export function compressToolResults<T>(body: T): RtkResult<T> {
  if (!body) return { body, savedChars: 0 };
  const bodyRecord = asRecord(body);
  if (!bodyRecord) return { body, savedChars: 0 };

  const hits: NonNullable<RtkResult["hits"]> = [];

  // OpenAI chat / Claude-shaped messages
  if (Array.isArray(bodyRecord.messages)) {
    const nextMessages = bodyRecord.messages.map((message) => {
      const messageRecord = asRecord(message);
      if (!messageRecord) return message;

      if (messageRecord.type === "function_call_output") {
        if (typeof messageRecord.output === "string") {
          const compressed = compressText(messageRecord.output, hits, "openai-responses-string");
          return compressed !== messageRecord.output ? { ...messageRecord, output: compressed } : message;
        }
        if (Array.isArray(messageRecord.output)) {
          let changed = false;
          const output = messageRecord.output.map((part) => {
            const partRecord = asRecord(part);
            if (partRecord?.type === "input_text" && typeof partRecord.text === "string") {
              const compressed = compressText(partRecord.text, hits, "openai-responses-array");
              if (compressed !== partRecord.text) {
                changed = true;
                return { ...partRecord, text: compressed };
              }
            }
            return part;
          });
          return changed ? { ...messageRecord, output } : message;
        }
        return message;
      }

      if (messageRecord.role === "tool") {
        const content = compressToolMessageContent(messageRecord.content, hits, "openai-tool");
        return content !== messageRecord.content ? { ...messageRecord, content } : message;
      }

      if (Array.isArray(messageRecord.content)) {
        const content = compressToolMessageContent(messageRecord.content, hits, "blocks");
        return content !== messageRecord.content ? { ...messageRecord, content } : message;
      }

      return message;
    });

    const savedChars = hits.reduce((sum, hit) => sum + hit.saved, 0);
    if (savedChars === 0) return { body, savedChars: 0, hits };
    return { body: { ...bodyRecord, messages: nextMessages } as T, savedChars, hits };
  }

  // OpenAI Responses API: body.input
  if (Array.isArray(bodyRecord.input)) {
    const nextInput = bodyRecord.input.map((message) => {
      const messageRecord = asRecord(message);
      if (!messageRecord) return message;
      if (messageRecord.type === "function_call_output") {
        if (typeof messageRecord.output === "string") {
          const compressed = compressText(messageRecord.output, hits, "openai-responses-string");
          return compressed !== messageRecord.output ? { ...messageRecord, output: compressed } : message;
        }
      }
      if (messageRecord.role === "tool" && typeof messageRecord.content === "string") {
        const compressed = compressText(messageRecord.content, hits, "openai-tool");
        return compressed !== messageRecord.content ? { ...messageRecord, content: compressed } : message;
      }
      return message;
    });
    const savedChars = hits.reduce((sum, hit) => sum + hit.saved, 0);
    if (savedChars === 0) return { body, savedChars: 0, hits };
    return { body: { ...bodyRecord, input: nextInput } as T, savedChars, hits };
  }

  return { body, savedChars: 0 };
}
