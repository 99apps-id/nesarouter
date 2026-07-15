import { describe, expect, it } from "vitest";
import { azureOpenAiAuthHeaders, xiaomiMimoAuthHeaders, xiaomiMimoCredentialHint } from "@/core/providers/shared";
import type { ProviderConfig } from "@/core/types";

function provider(partial: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: "xiaomi-mimo",
    name: "Xiaomi MiMo",
    type: "openai_compatible",
    tier: "cheap",
    status: "active",
    baseUrl: "https://api.xiaomimimo.com/v1",
    apiKey: "",
    model: "mimo-v2.5",
    priority: 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    ...partial
  };
}

describe("xiaomi mimo auth helpers", () => {
  it("adds api-key header for Xiaomi hosts", () => {
    expect(xiaomiMimoAuthHeaders("sk-test", provider({}))).toEqual({ "api-key": "sk-test" });
    expect(xiaomiMimoAuthHeaders("sk-test", provider({ baseUrl: "https://api.openai.com/v1" }))).toEqual({});
  });

  it("warns when Token Plan key is used against pay-as-you-go host", () => {
    expect(xiaomiMimoCredentialHint(provider({}), "tp-abc")).toMatch(/Token Plan/i);
  });

  it("warns when pay-as-you-go key is used against Token Plan host", () => {
    expect(
      xiaomiMimoCredentialHint(
        provider({ id: "xiaomi-tokenplan", baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1" }),
        "sk-abc"
      )
    ).toMatch(/pay-as-you-go/i);
  });

  it("allows matching key/host pairs", () => {
    expect(xiaomiMimoCredentialHint(provider({}), "sk-abc")).toBeUndefined();
    expect(
      xiaomiMimoCredentialHint(
        provider({ id: "xiaomi-tokenplan", baseUrl: "https://token-plan-cn.xiaomimimo.com/v1" }),
        "tp-abc"
      )
    ).toBeUndefined();
  });
});

describe("azure openai auth helpers", () => {
  it("adds api-key header for Azure OpenAI hosts", () => {
    expect(
      azureOpenAiAuthHeaders(
        "key",
        provider({ id: "azure-openai", baseUrl: "https://myres.openai.azure.com/openai/v1" })
      )
    ).toEqual({ "api-key": "key" });
    expect(azureOpenAiAuthHeaders("key", provider({ baseUrl: "https://api.openai.com/v1" }))).toEqual({});
  });
});
