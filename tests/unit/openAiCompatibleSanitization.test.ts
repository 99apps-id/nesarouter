import { describe, expect, it } from "vitest";
import { prepareOpenAiUpstreamBody } from "@/core/providers/openaiCompatible";
import type { ProviderConfig } from "@/core/types";

function provider(id: string, baseUrl: string): ProviderConfig {
  return {
    id,
    name: id,
    type: "openai_compatible",
    tier: "cheap",
    status: "active",
    baseUrl,
    apiKey: "test",
    model: "test-model",
    priority: 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  } as ProviderConfig;
}

describe("OpenAI-compatible request sanitization", () => {
  it("adds an optional placeholder only to empty Runware function schemas", () => {
    const body = {
      messages: [{ role: "user", content: "run a tool" }],
      tools: [
        { type: "function", function: { name: "no_args", parameters: { type: "object", properties: {} } } },
        { type: "function", function: { name: "with_args", parameters: { type: "object", properties: { path: { type: "string" } } } } }
      ]
    };
    const result = prepareOpenAiUpstreamBody(body, provider("runware", "https://api.runware.ai/v1"));
    const tools = result.tools as typeof body.tools;
    expect(tools[0].function.parameters.properties).toHaveProperty("__unused");
    expect(tools[1]).toEqual(body.tools[1]);
    expect(body.tools[0].function.parameters.properties).toEqual({});
  });

  it("does not alter empty schemas for other compatible providers", () => {
    const body = {
      tools: [{ type: "function", function: { name: "no_args", parameters: { type: "object", properties: {} } } }]
    };
    expect(prepareOpenAiUpstreamBody(body, provider("groq", "https://api.groq.com/openai/v1"))).toEqual(body);
  });

  it("strips strict Mistral fields without changing tools", () => {
    const tools = [{ type: "function", function: { name: "no_args", parameters: { type: "object", properties: {} } } }];
    expect(prepareOpenAiUpstreamBody({ user: "account", store: true, tools }, provider("mistral", "https://api.mistral.ai/v1"))).toEqual({ tools });
  });
});
