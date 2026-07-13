import { describe, expect, it } from "vitest";
import {
  claudeResponseToOpenAi,
  openAiChatToClaudeRequest,
  openAiChatToResponsesRequest,
  responsesResponseToOpenAi
} from "@/core/translatorReverse";

describe("translatorReverse: openAiChatToClaudeRequest", () => {
  it("collects system messages into system field", () => {
    const req = openAiChatToClaudeRequest({
      model: "claude-sonnet-5",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" }
      ],
      max_tokens: 256
    });
    expect(req.system).toBe("You are helpful.");
    expect(req.messages).toEqual([{ role: "user", content: [{ type: "text", text: "Hi" }] }]);
    expect(req.max_tokens).toBe(256);
  });

  it("maps assistant tool_calls to tool_use blocks and tool messages to tool_result", () => {
    const req = openAiChatToClaudeRequest({
      model: "claude-sonnet-5",
      messages: [
        { role: "user", content: "use the tool" },
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call_1", type: "function", function: { name: "search", arguments: '{"q":"x"}' } }]
        },
        { role: "tool", tool_call_id: "call_1", content: "result body" }
      ]
    });
    expect(req.messages[1].content).toContainEqual(expect.objectContaining({ type: "tool_use", id: "call_1", name: "search", input: { q: "x" } }));
    expect(req.messages[2]).toEqual({ role: "user", content: [{ type: "tool_result", tool_use_id: "call_1", content: "result body" }] });
  });

  it("maps tools to anthropic tool schemas", () => {
    const req = openAiChatToClaudeRequest({
      model: "claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
      tools: [{ type: "function", function: { name: "t", description: "d", parameters: { type: "object" } } }]
    });
    expect(req.tools[0]).toEqual({ name: "t", description: "d", input_schema: { type: "object" } });
  });

  it("preserves image_url on user messages (data URI → Claude base64 image)", () => {
    const req = openAiChatToClaudeRequest({
      model: "claude-sonnet-5",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "what is this?" },
          { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } }
        ]
      }]
    });
    expect(req.messages[0].content).toEqual([
      { type: "text", text: "what is this?" },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" } }
    ]);
  });

  it("preserves multimodal tool results (agent Read image path)", () => {
    const req = openAiChatToClaudeRequest({
      model: "claude-sonnet-5",
      messages: [
        { role: "user", content: "read the screenshot" },
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call_1", type: "function", function: { name: "Read", arguments: '{"path":"x.png"}' } }]
        },
        {
          role: "tool",
          tool_call_id: "call_1",
          content: [
            { type: "text", text: "see attached images" },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64,CAT" } }
          ]
        }
      ]
    });
    const toolResult = req.messages[2].content[0];
    expect(toolResult.type).toBe("tool_result");
    expect(toolResult.tool_use_id).toBe("call_1");
    expect(toolResult.content).toEqual([
      { type: "text", text: "see attached images" },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "CAT" } }
    ]);
  });
});

describe("translatorReverse: claudeResponseToOpenAi", () => {
  it("converts text + tool_use blocks and usage", () => {
    const out = claudeResponseToOpenAi(
      {
        id: "msg_1",
        content: [
          { type: "text", text: "Hello" },
          { type: "tool_use", id: "tu_1", name: "search", input: { q: "x" } }
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 10, output_tokens: 20 }
      },
      "claude-sonnet-5"
    );
    expect(out.choices[0].message.content).toBe("Hello");
    expect(out.choices[0].message.tool_calls[0].function.name).toBe("search");
    expect(out.choices[0].finish_reason).toBe("tool_calls");
    expect(out.usage).toEqual({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 });
  });
});

describe("translatorReverse: responses", () => {
  it("builds responses request with instructions + input", () => {
    const req = openAiChatToResponsesRequest({
      model: "gpt-5.6-sol",
      messages: [
        { role: "system", content: "Be terse." },
        { role: "user", content: "Ping" }
      ],
      max_tokens: 64
    });
    expect(req.instructions).toBe("Be terse.");
    expect(req.input).toEqual([{ role: "user", content: "Ping" }]);
    expect(req.max_output_tokens).toBe(64);
  });

  it("converts responses payload to openai chat", () => {
    const out = responsesResponseToOpenAi(
      {
        id: "resp_1",
        output: [{ content: [{ type: "output_text", text: "Pong" }] }],
        usage: { input_tokens: 5, output_tokens: 7 }
      },
      "gpt-5.6-sol"
    );
    expect(out.choices[0].message.content).toBe("Pong");
    expect(out.usage).toEqual({ prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 });
  });
});
