import { describe, expect, it } from "vitest";
import { withStreamEnd } from "@/core/streaming";

describe("withStreamEnd", () => {
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
