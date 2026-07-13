import { ProviderConfig } from "@/core/types";

export interface OpenAiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function splitSseEvents(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  let rest = buffer;
  let idx = rest.indexOf("\n\n");
  while (idx >= 0) {
    events.push(rest.slice(0, idx));
    rest = rest.slice(idx + 2);
    idx = rest.indexOf("\n\n");
  }
  return { events, rest };
}

function dataLineFromEvent(event: string) {
  return event
    .split(/\r?\n/)
    .find((line) => line.startsWith("data:"))
    ?.slice(5)
    .trim();
}

/**
 * Pass OpenAI SSE bytes through unchanged while extracting `usage` from the
 * final chunk. Calls `onUsage` each time a chunk carries usage (the last one
 * wins). Returns a ReadableStream<Uint8Array> in identical OpenAI SSE format.
 */
export function trackOpenAiStreamUsage(
  input: ReadableStream<Uint8Array>,
  onUsage: (usage: OpenAiUsage) => void
): ReadableStream<Uint8Array> {
  let buffer = "";
  return input.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        buffer += textDecoder.decode(chunk, { stream: true });
        const { events, rest } = splitSseEvents(buffer);
        buffer = rest;
        for (const event of events) {
          const data = dataLineFromEvent(event);
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed?.usage && (parsed.usage.prompt_tokens || parsed.usage.completion_tokens)) {
              onUsage(parsed.usage as OpenAiUsage);
            }
          } catch {
            // ignore non-JSON keepalive lines
          }
        }
      },
      flush() {
        if (buffer.trim()) {
          const data = dataLineFromEvent(buffer);
          if (data && data !== "[DONE]") {
            try {
              const parsed = JSON.parse(data);
              if (parsed?.usage) onUsage(parsed.usage as OpenAiUsage);
            } catch {}
          }
        }
      }
    })
  );
}

/**
 * Transform a Gemini `streamGenerateContent?alt=sse` response body into
 * OpenAI-compatible SSE chunks. Emits a final `[DONE]` sentinel and reports
 * usage via `onUsage` when Gemini sends `usageMetadata`.
 */
export function geminiStreamToOpenAiSse(
  geminiBody: ReadableStream<Uint8Array>,
  provider: ProviderConfig,
  onUsage: (usage: OpenAiUsage) => void
): ReadableStream<Uint8Array> {
  const id = `gemini-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  let buffer = "";

  return geminiBody.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += textDecoder.decode(chunk, { stream: true });
        const { events, rest } = splitSseEvents(buffer);
        buffer = rest;
        for (const event of events) {
          const data = dataLineFromEvent(event);
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            const parts = parsed?.candidates?.[0]?.content?.parts ?? [];
            const text = parts.map((part: any) => part?.text ?? "").join("");
            const finishReason = parsed?.candidates?.[0]?.finishReason?.toLowerCase?.() ?? null;
            const usageMeta = parsed?.usageMetadata;
            const openAiChunk: Record<string, unknown> = {
              id,
              object: "chat.completion.chunk",
              created,
              model: provider.model,
              choices: [
                {
                  index: 0,
                  delta: text ? { content: text } : {},
                  finish_reason: finishReason ?? null
                }
              ]
            };
            if (usageMeta) {
              const usage: OpenAiUsage = {
                prompt_tokens: usageMeta.promptTokenCount ?? 0,
                completion_tokens: usageMeta.candidatesTokenCount ?? 0,
                total_tokens: usageMeta.totalTokenCount ?? 0
              };
              openAiChunk.usage = usage;
              onUsage(usage);
            }
            controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
          } catch {
            // skip malformed chunk
          }
        }
      },
      flush(controller) {
        controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
      }
    })
  );
}

/**
 * Wrap a stream so `onEnd` receives the terminal state. A stream may fail only
 * after bytes have reached the client, so the caller can record an accurate
 * audit result even though fallback is no longer safe at that point.
 */
export type StreamEndState =
  | { status: "success" }
  | { status: "cancelled"; reason?: unknown }
  | { status: "error"; error: unknown };

export function withStreamEnd<T>(
  input: ReadableStream<T>,
  onEnd: (state: StreamEndState) => void
): ReadableStream<T> {
  let finished = false;
  let reader: ReadableStreamDefaultReader<T> | undefined;
  const fire = (state: StreamEndState) => {
    if (finished) return;
    finished = true;
    try {
      onEnd(state);
    } catch {}
  };
  return new ReadableStream<T>({
    start(controller) {
      reader = input.getReader();
      const pump = (): Promise<void> =>
        reader!.read().then(({ done, value }) => {
          if (done) {
            controller.close();
            fire({ status: "success" });
            return;
          }
          controller.enqueue(value);
          return pump();
        });
      pump().catch((err) => {
        controller.error(err);
        fire({ status: "error", error: err });
      });
    },
    cancel(reason) {
      void reader?.cancel(reason).catch(() => {});
      fire({ status: "cancelled", reason });
    }
  });
}
