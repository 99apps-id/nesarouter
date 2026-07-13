import { describe, it, expect } from "vitest";
import { claudeToOpenAi, openAiToClaude, responsesToOpenAi, openAiToResponses } from "@/core/translator";

describe("translator claude", () => {
  it("converts a simple Claude request to OpenAI chat", () => {
    const openAi = claudeToOpenAi({ model: "m", max_tokens: 100, messages: [{ role: "user", content: "hi" }], system: "be brief" });
    expect(openAi.messages[0]).toEqual({ role: "system", content: "be brief" });
    expect(openAi.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(openAi.max_tokens).toBe(100);
  });

  it("maps tool_use and tool_result blocks", () => {
    const openAi = claudeToOpenAi({
      model: "m",
      messages: [
        { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "get", input: { q: "a" } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "done" }] }
      ]
    });
    const assistant = openAi.messages.find((m: any) => m.role === "assistant");
    expect(assistant.tool_calls[0].function.name).toBe("get");
    expect(JSON.parse(assistant.tool_calls[0].function.arguments)).toEqual({ q: "a" });
    const tool = openAi.messages.find((m: any) => m.role === "tool");
    expect(tool.tool_call_id).toBe("t1");
    expect(tool.content).toBe("done");
  });

  it("converts OpenAI completion back to Claude shape", () => {
    const claude = openAiToClaude({
      id: "x",
      choices: [{ finish_reason: "stop", message: { content: "hello" } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 }
    }, "m");
    expect(claude.content).toEqual([{ type: "text", text: "hello" }]);
    expect(claude.stop_reason).toBe("end_turn");
    expect(claude.usage).toEqual({ input_tokens: 5, output_tokens: 3 });
  });

  it("maps tool_calls back to tool_use blocks", () => {
    const claude = openAiToClaude({
      choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "t1", function: { name: "get", arguments: '{"q":"a"}' } }] } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 }
    }, "m");
    expect(claude.content[0].type).toBe("tool_use");
    expect(claude.content[0].input).toEqual({ q: "a" });
    expect(claude.stop_reason).toBe("tool_use");
  });

  it("preserves images inside tool_result (not text-only flatten)", () => {
    const openAi = claudeToOpenAi({
      model: "m",
      messages: [
        { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Read", input: { path: "a.png" } }] },
        {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: "t1",
            content: [
              { type: "text", text: "see attached images" },
              { type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" } }
            ]
          }]
        }
      ]
    });
    const tool = openAi.messages.find((m: any) => m.role === "tool");
    expect(tool.content).toEqual([
      { type: "text", text: "see attached images" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } }
    ]);
  });

  it("preserves user message images as OpenAI content parts", () => {
    const openAi = claudeToOpenAi({
      model: "m",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "describe" },
          { type: "image", source: { type: "url", url: "https://example.com/a.png" } }
        ]
      }]
    });
    expect(openAi.messages[0].content).toEqual([
      { type: "text", text: "describe" },
      { type: "image_url", image_url: { url: "https://example.com/a.png" } }
    ]);
  });
});

describe("translator responses", () => {
  it("converts a Responses request with string input", () => {
    const openAi = responsesToOpenAi({ model: "m", input: "hi", instructions: "be brief", max_output_tokens: 50 });
    expect(openAi.messages).toEqual([{ role: "system", content: "be brief" }, { role: "user", content: "hi" }]);
    expect(openAi.max_tokens).toBe(50);
  });

  it("converts a chat completion to a Responses object", () => {
    const resp = openAiToResponses({
      id: "x",
      created: 1,
      choices: [{ message: { content: "answer" } }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 }
    }, "m");
    expect(resp.object).toBe("response");
    expect(resp.status).toBe("completed");
    expect(resp.output[0].content[0]).toEqual({ type: "output_text", text: "answer" });
    expect(resp.usage).toEqual({ input_tokens: 2, output_tokens: 3, total_tokens: 5 });
  });
});
