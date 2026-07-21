import { describe, expect, it } from "vitest";
import { configuredProviderKeys, pickActiveKeys, rememberKeyUse } from "@/core/providerKeys";
import { ProviderConfig } from "@/core/types";

function provider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "accounts",
    name: "Accounts",
    type: "openai_compatible",
    tier: "cheap",
    status: "active",
    baseUrl: "https://example.test/v1",
    apiKey: "primary",
    apiKeys: ["second", "third"],
    model: "model",
    priority: 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    ...overrides
  };
}

describe("provider account pool", () => {
  it("keeps the primary and additional accounts in one pool", () => {
    expect(configuredProviderKeys(provider()).map((item) => item.key)).toEqual(["primary", "second", "third"]);
  });

  it("rotates from the account used by the prior request", () => {
    const item = provider();
    expect(pickActiveKeys(item).map((entry) => entry.key)).toEqual(["primary", "second", "third"]);
    rememberKeyUse(item.id, 1);
    expect(pickActiveKeys(item).map((entry) => entry.key)).toEqual(["third", "primary", "second"]);
  });

  it("removes duplicate credentials from the pool", () => {
    expect(configuredProviderKeys(provider({ apiKeys: ["primary", "second"] }))).toEqual([
      { key: "primary", index: 0 },
      { key: "second", index: 1 }
    ]);
  });

  it("keeps quota indexes compact when blank and duplicate credentials are present", () => {
    expect(configuredProviderKeys(provider({ apiKey: "", apiKeys: ["second", "", "second", "third"] }))).toEqual([
      { key: "second", index: 0 },
      { key: "third", index: 1 }
    ]);
  });
});
