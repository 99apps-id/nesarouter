import { describe, expect, it } from "vitest";
import { shouldDisableDeepSeekThinking } from "@/core/providers/openaiCompatible";
import { ProviderConfig } from "@/core/types";

function deepseek(model = "deepseek-v4-flash"): ProviderConfig {
  return {
    id: "deepseek",
    name: "DeepSeek",
    type: "openai_compatible",
    tier: "cheap",
    status: "active",
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-test",
    model,
    priority: 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  };
}

describe("DeepSeek thinking default", () => {
  it("disables thinking when client did not set it", () => {
    expect(shouldDisableDeepSeekThinking(deepseek(), { messages: [] })).toBe(true);
  });

  it("respects explicit thinking from the client", () => {
    expect(shouldDisableDeepSeekThinking(deepseek(), { thinking: { type: "enabled" } })).toBe(false);
  });

  it("does not force-disable unrelated OpenAI-compatible providers", () => {
    const groq = { ...deepseek(), id: "groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b" };
    expect(shouldDisableDeepSeekThinking(groq, { messages: [] })).toBe(false);
  });
});
