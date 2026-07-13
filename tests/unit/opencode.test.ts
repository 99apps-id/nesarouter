import { describe, expect, it } from "vitest";
import { OpenCodeExecutor } from "@/core/providers/opencode";
import { ProviderConfig } from "@/core/types";

const provider = {
  id: "opencode-free",
  name: "OpenCode Free",
  type: "opencode",
  tier: "free",
  status: "active",
  baseUrl: "https://opencode.ai",
  apiKey: "user-key-should-be-ignored",
  model: "gpt-5.6-sol",
  priority: 16,
  inputCostPerMTok: 0,
  outputCostPerMTok: 0
} as ProviderConfig;

describe("OpenCode Free executor", () => {
  it("lists models from zen/v1/models with public bearer", async () => {
    const models = await new OpenCodeExecutor().listModels(provider);
    expect(models.length).toBeGreaterThan(0);
    expect(models).toContain("gpt-5.6-sol");
  }, 30_000);

  it("validates connection via model list", async () => {
    const result = await new OpenCodeExecutor().validate(provider);
    expect(result.models?.length).toBeGreaterThan(0);
    expect(result.message).toMatch(/models found|connected/i);
  }, 30_000);
});
