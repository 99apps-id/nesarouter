import { describe, expect, it } from "vitest";
import { configuredOAuthAccounts, oauthAccountCount, pickActiveOAuthAccounts, rememberOAuthAccountUse, routableOAuthAccountCount } from "@/core/oauthAccounts";
import { ProviderConfig } from "@/core/types";

function oauthProvider(accounts: ProviderConfig["oauthAccounts"]): ProviderConfig {
  return {
    id: "oauth-chatgpt",
    name: "Codex",
    type: "openai_responses",
    tier: "premium",
    status: "active",
    baseUrl: "https://example.test",
    apiKey: "",
    model: "gpt-5.6-sol",
    priority: 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    oauthProfile: "openai_codex",
    oauthAccounts: accounts
  };
}

describe("oauth account pool", () => {
  it("keeps multiple connected accounts in one provider", () => {
    const provider = oauthProvider([
      { id: "a1", name: "Account 1", oauthAccessToken: "tok-1" },
      { id: "a2", name: "Account 2", oauthAccessToken: "tok-2" }
    ]);
    expect(oauthAccountCount(provider)).toBe(2);
    expect(configuredOAuthAccounts(provider).map((item) => item.id)).toEqual(["a1", "a2"]);
  });

  it("rotates oauth accounts between requests", () => {
    const provider = oauthProvider([
      { id: "a1", name: "Account 1", oauthAccessToken: "tok-1" },
      { id: "a2", name: "Account 2", oauthAccessToken: "tok-2" }
    ]);
    expect(pickActiveOAuthAccounts(provider).map((item) => item.id)).toEqual(["a1", "a2"]);
    rememberOAuthAccountUse(provider.id, 0);
    expect(pickActiveOAuthAccounts(provider).map((item) => item.id)).toEqual(["a2", "a1"]);
  });

  it("skips error-status accounts in routing pool", () => {
    const provider = oauthProvider([
      { id: "a1", name: "Account 1", oauthAccessToken: "tok-1", connectionStatus: "error", lastError: "quota exceeded" },
      { id: "a2", name: "Account 2", oauthAccessToken: "tok-2", connectionStatus: "connected" }
    ]);
    expect(pickActiveOAuthAccounts(provider).map((item) => item.id)).toEqual(["a2"]);
    expect(routableOAuthAccountCount(provider)).toBe(1);
  });
});
