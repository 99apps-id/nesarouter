import { describe, expect, it } from "vitest";
import { parsePrefixedModel, resolvePrefixToProviderId } from "@/core/providerPrefixes";
import { compareVersions } from "@/lib/updateCheck";
import { ProviderConfig } from "@/core/types";

const providers = [
  {
    id: "oauth-chatgpt",
    name: "Codex",
    type: "openai_responses",
    tier: "premium",
    status: "active",
    baseUrl: "https://example.com",
    apiKey: "",
    model: "gpt-5.5",
    models: ["gpt-5.5", "gpt-5.4"],
    priority: 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  },
  {
    id: "openrouter-free",
    name: "OpenRouter Free",
    type: "openai_compatible",
    tier: "free",
    status: "active",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "x",
    model: "openrouter/free",
    models: ["openrouter/free", "meta-llama/llama-3.1-8b-instruct:free"],
    priority: 2,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }
] as ProviderConfig[];

describe("provider prefixes", () => {
  it("resolves cx and codex prefixes for Codex", () => {
    expect(resolvePrefixToProviderId("cx", providers)).toBe("oauth-chatgpt");
    expect(resolvePrefixToProviderId("codex", providers)).toBe("oauth-chatgpt");
    expect(parsePrefixedModel("cx/gpt-5.5", providers)).toEqual({
      prefix: "cx",
      providerId: "oauth-chatgpt",
      modelId: "gpt-5.5"
    });
    expect(parsePrefixedModel("codex/gpt-5.5", providers)?.providerId).toBe("oauth-chatgpt");
  });

  it("keeps slash-containing configured model ids intact", () => {
    expect(parsePrefixedModel("openrouter/free", providers)).toBeNull();
    expect(parsePrefixedModel("meta-llama/llama-3.1-8b-instruct:free", providers)).toBeNull();
  });

  it("accepts full provider id prefixes", () => {
    expect(parsePrefixedModel("oauth-chatgpt/gpt-5.4", providers)?.modelId).toBe("gpt-5.4");
  });
});

describe("compareVersions", () => {
  it("orders semver tags", () => {
    expect(compareVersions("0.1.1", "0.1.0")).toBe(1);
    expect(compareVersions("v0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("0.1.0", "0.2.0")).toBe(-1);
  });
});
