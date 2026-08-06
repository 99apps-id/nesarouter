import { describe, expect, it } from "vitest";
import { geminiStreamToOpenAiSse, trackOpenAiStreamUsage, withStreamEnd } from "@/core/streaming";
import type { ProviderConfig } from "@/core/types";

describe("trackOpenAiStreamUsage", () => {
  it("observes streamed output when the provider omits usage", async () => {
    const encoder = new TextEncoder();
    const output: string[] = [];
    const usages: unknown[] = [];
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"tool_calls":[{"function":{"arguments":"{\\"ok\\":true}"}}]}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    });

    const tracked = trackOpenAiStreamUsage(input, (usage) => usages.push(usage), (text) => output.push(text));
    const reader = tracked.getReader();
    while (!(await reader.read()).done) {}

    expect(output.join("")).toBe('hello{"ok":true}');
    expect(usages).toEqual([]);
  });
});

describe("geminiStreamToOpenAiSse", () => {
  it("maps functionCall parts to OpenAI tool_calls deltas", async () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const provider = { model: "gemini-2.5-flash" } as ProviderConfig;
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ functionCall: { name: "lookup", args: { q: "jakarta" } } }]
                  },
                  finishReason: "STOP"
                }
              ]
            })}\n\n`
          )
        );
        controller.close();
      }
    });

    const stream = geminiStreamToOpenAiSse(input, provider, () => {});
    const reader = stream.getReader();
    const chunks: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }
    const joined = chunks.join("");
    expect(joined).toContain('"finish_reason":"tool_calls"');
    expect(joined).toContain('"name":"lookup"');
    expect(joined).toContain('"arguments":"{\\"q\\":\\"jakarta\\"}"');
    expect(joined).toContain("data: [DONE]");
  });
});

describe("withStreamEnd", () => {
  it("waits for asynchronous financial finalization before closing", async () => {
    const events: string[] = [];
    const wrapped = withStreamEnd(
      new ReadableStream<string>({
        start(controller) {
          controller.enqueue("done");
          controller.close();
        }
      }),
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        events.push("settled");
      }
    );
    const reader = wrapped.getReader();
    expect(await reader.read()).toEqual({ done: false, value: "done" });
    expect(events).toEqual([]);
    expect(await reader.read()).toEqual({ done: true, value: undefined });
    expect(events).toEqual(["settled"]);
  });

  it("reports successful completion", async () => {
    const events: string[] = [];
    const wrapped = withStreamEnd(
      new ReadableStream<string>({
        start(controller) {
          controller.enqueue("done");
          controller.close();
        }
      }),
      (state) => events.push(state.status)
    );

    const reader = wrapped.getReader();
    expect(await reader.read()).toEqual({ done: false, value: "done" });
    expect(await reader.read()).toEqual({ done: true, value: undefined });
    expect(events).toEqual(["success"]);
  });

  it("reports an upstream stream error", async () => {
    const events: string[] = [];
    const wrapped = withStreamEnd(
      new ReadableStream<string>({
        start(controller) {
          controller.error(new Error("upstream disconnected"));
        }
      }),
      (state) => events.push(state.status)
    );

    await expect(wrapped.getReader().read()).rejects.toThrow("upstream disconnected");
    expect(events).toEqual(["error"]);
  });
});
