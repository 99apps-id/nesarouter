import { describe, expect, it } from "vitest";
import { openaiMessagesToCursor } from "@/core/providers/cursor";

describe("cursor message conversion", () => {
  it("preserves assistant tool_calls and OpenAI tool results", () => {
    const out = openaiMessagesToCursor({
      messages: [
        { role: "user", content: "read file" },
        {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "call_1", type: "function", function: { name: "Read", arguments: "{\"path\":\"a.ts\"}" } }]
        },
        { role: "tool", tool_call_id: "call_1", content: "file contents" }
      ]
    });
    expect(out[0]).toMatchObject({ role: "user", content: "read file" });
    expect(out[1].tool_calls?.[0]?.id).toBe("call_1");
    expect(out[2]).toMatchObject({
      role: "assistant",
      tool_results: [
        {
          tool_call_id: "call_1",
          content: "file contents",
          tool_name: "Read",
          raw_args: "{\"path\":\"a.ts\"}"
        }
      ]
    });
  });

  it("prepends system prompts onto the first user message", () => {
    const out = openaiMessagesToCursor({
      messages: [
        { role: "system", content: "be brief" },
        { role: "user", content: "hi" }
      ]
    });
    expect(out).toHaveLength(1);
    expect(out[0].content).toContain("be brief");
    expect(out[0].content).toContain("hi");
  });
});
