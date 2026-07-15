import { describe, expect, it } from "vitest";
import {
  configuredOAuthAccounts,
  oauthAccountCount,
  pickActiveOAuthAccounts,
  providerWithFreshOAuthToken,
  rememberOAuthAccountUse,
  routableOAuthAccountCount
} from "@/core/oauthAccounts";
import { ProviderConfig } from "@/core/types";

function oauthProvider(accounts: ProviderConfig["oauthAccounts"], partial: Partial<ProviderConfig> = {}): ProviderConfig {
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
    oauthAccounts: accounts,
    ...partial
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

  it("maps Copilot fresh token onto oauthCopilotToken, not oauthAccessToken", () => {
    const provider = oauthProvider(
      [{ id: "a1", name: "Account 1", oauthAccessToken: "gho_github", connectionStatus: "connected" }],
      {
        id: "oauth-github-copilot",
        name: "GitHub Copilot",
        type: "github_copilot",
        oauthProfile: "github_copilot"
      }
    );
    const account = configuredOAuthAccounts(provider)[0];
    const snapshot = providerWithFreshOAuthToken(provider, account, "copilot_session_abc");
    expect(snapshot.oauthCopilotToken).toBe("copilot_session_abc");
    expect(snapshot.oauthAccessToken).toBe("gho_github");
  });

  it("maps standard OAuth fresh token onto oauthAccessToken", () => {
    const provider = oauthProvider([
      { id: "a1", name: "Account 1", oauthAccessToken: "old", connectionStatus: "connected" }
    ]);
    const account = configuredOAuthAccounts(provider)[0];
    const snapshot = providerWithFreshOAuthToken(provider, account, "new_access");
    expect(snapshot.oauthAccessToken).toBe("new_access");
    expect(snapshot.oauthCopilotToken).toBeUndefined();
  });

  it("revives tokens from provider columns when oauthAccounts slots were wiped", () => {
    const provider = oauthProvider(
      [{ id: "legacy", name: "Account 1", connectionStatus: "connected" }],
      {
        oauthAccessToken: "gho_revived",
        oauthRefreshToken: "refresh_revived"
      }
    );
    expect(oauthAccountCount(provider)).toBe(1);
    expect(routableOAuthAccountCount(provider)).toBe(1);
    expect(configuredOAuthAccounts(provider)[0].oauthAccessToken).toBe("gho_revived");
  });

  it("revives Cursor machine id from provider columns", () => {
    const provider = oauthProvider(
      [{ id: "a1", name: "Account 1", oauthAccessToken: "cursor_tok", connectionStatus: "connected" }],
      {
        id: "oauth-cursor",
        type: "cursor",
        oauthProfile: "cursor",
        oauthMachineId: "machine-from-column"
      }
    );
    expect(configuredOAuthAccounts(provider)[0].oauthMachineId).toBe("machine-from-column");
    expect(routableOAuthAccountCount(provider)).toBe(1);
  });

  it("does not treat Cursor account without machine id as routable", () => {
    const provider = oauthProvider(
      [{ id: "a1", name: "Account 1", oauthAccessToken: "cursor_tok", connectionStatus: "connected" }],
      {
        id: "oauth-cursor",
        type: "cursor",
        oauthProfile: "cursor"
      }
    );
    expect(oauthAccountCount(provider)).toBe(1);
    expect(routableOAuthAccountCount(provider)).toBe(0);
  });
});
