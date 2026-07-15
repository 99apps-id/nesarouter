import { describe, expect, it } from "vitest";
import {
  isOpenCodeFreeModel,
  OpenCodeExecutor,
  resolveOpenCodeModel
} from "@/core/providers/opencode";
import { ProviderConfig } from "@/core/types";

const provider = {
  id: "opencode-free",
  name: "OpenCode Free",
  type: "opencode",
  tier: "free",
  status: "active",
  baseUrl: "https://opencode.ai",
  apiKey: "zen-user-key",
  model: "big-pickle",
  priority: 16,
  inputCostPerMTok: 0,
  outputCostPerMTok: 0
} as ProviderConfig;

describe("OpenCode Free executor", () => {
  it("lists only free models even when a Zen API key is set", async () => {
    const models = await new OpenCodeExecutor().listModels(provider);
    expect(models.length).toBeGreaterThan(0);
    expect(models).toContain("big-pickle");
    expect(models.every((id) => isOpenCodeFreeModel(id))).toBe(true);
    expect(models).not.toContain("gpt-5.6-sol");
    expect(models).not.toContain("claude-sonnet-4-5");
  }, 30_000);

  it("validates connection via free model list", async () => {
    const result = await new OpenCodeExecutor().validate(provider);
    expect(result.models?.length).toBeGreaterThan(0);
    expect(result.models?.every((id) => isOpenCodeFreeModel(id))).toBe(true);
    expect(result.message).toMatch(/models found|connected/i);
  }, 30_000);

  it("remaps paid model ids back to the free default", () => {
    expect(resolveOpenCodeModel("gpt-5.6-sol", provider)).toBe("big-pickle");
    expect(resolveOpenCodeModel("deepseek-v4-flash-free", provider)).toBe("deepseek-v4-flash-free");
    expect(isOpenCodeFreeModel("hy3-free")).toBe(true);
    expect(isOpenCodeFreeModel("claude-opus-4-6")).toBe(false);
  });
});
