import { describe, expect, it } from "vitest";
import { chatCompletionsUrl, shouldDisableDeepSeekThinking } from "@/core/providers/openaiCompatible";
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
  } as ProviderConfig;
}

describe("DeepSeek thinking defaults", () => {
  it("disables thinking on V4/chat hosts when client omits thinking", () => {
    expect(shouldDisableDeepSeekThinking(deepseek(), { messages: [] })).toBe(true);
  });

  it("keeps thinking when client sets thinking explicitly", () => {
    expect(shouldDisableDeepSeekThinking(deepseek(), { thinking: { type: "enabled" } })).toBe(false);
  });

  it("does not disable thinking for reasoner models", () => {
    expect(shouldDisableDeepSeekThinking(deepseek("deepseek-reasoner"), { messages: [] })).toBe(false);
  });

  it("does not inject thinking onto Runware DeepSeek AIR models", () => {
    const runware = {
      ...deepseek("deepseek:v4@flash"),
      id: "runware",
      baseUrl: "https://api.runware.ai/v1"
    } as ProviderConfig;
    expect(shouldDisableDeepSeekThinking(runware, { messages: [] })).toBe(false);
  });

  it("does not touch unrelated hosts", () => {
    const groq = {
      ...deepseek("llama-3.1-70b"),
      id: "groq",
      baseUrl: "https://api.groq.com/openai/v1"
    } as ProviderConfig;
    expect(shouldDisableDeepSeekThinking(groq, { messages: [] })).toBe(false);
  });

  it("disables thinking for DeepSeek models hosted on OpenCode Zen", () => {
    const opencode = {
      ...deepseek("deepseek-v4-flash-free"),
      id: "opencode-free",
      type: "opencode",
      baseUrl: "https://opencode.ai"
    } as ProviderConfig;
    expect(shouldDisableDeepSeekThinking(opencode, { messages: [] })).toBe(true);
  });
});

describe("chat completions URL", () => {
  it("does not double-append on MiMo free chat path", () => {
    const mimo = {
      ...deepseek(),
      id: "mimo-code-free",
      baseUrl: "https://api.xiaomimimo.com/api/free-ai/openai/chat"
    } as ProviderConfig;
    expect(chatCompletionsUrl(mimo)).toBe("https://api.xiaomimimo.com/api/free-ai/openai/chat");
  });

  it("appends /chat/completions for standard v1 bases", () => {
    expect(chatCompletionsUrl(deepseek())).toBe("https://api.deepseek.com/chat/completions");
  });
});
