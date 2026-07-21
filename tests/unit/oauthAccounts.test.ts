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

  it("compacts indexes after duplicate account ids are discarded", () => {
    const provider = oauthProvider([
      { id: "a1", oauthAccessToken: "tok-1" },
      { id: "a1", oauthAccessToken: "duplicate" },
      { id: "a2", oauthAccessToken: "tok-2" }
    ]);
    expect(configuredOAuthAccounts(provider).map(({ id, index }) => ({ id, index }))).toEqual([
      { id: "a1", index: 0 },
      { id: "a2", index: 1 }
    ]);
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

  it("does not copy the primary provider token into an empty secondary account", () => {
    const provider = oauthProvider(
      [
        { id: "primary", name: "Primary", connectionStatus: "connected" },
        { id: "secondary", name: "Secondary", connectionStatus: "connected" }
      ],
      { oauthAccessToken: "primary-token", oauthRefreshToken: "primary-refresh" }
    );

    const accounts = configuredOAuthAccounts(provider);
    expect(accounts[0].oauthAccessToken).toBe("primary-token");
    expect(accounts[1].oauthAccessToken).toBeUndefined();
    expect(accounts[1].oauthRefreshToken).toBeUndefined();
  });

  it("scopes a fresh-token provider snapshot to the active account", () => {
    const provider = oauthProvider([
      { id: "primary", name: "Primary", oauthAccessToken: "old-primary" },
      { id: "secondary", name: "Secondary", oauthAccessToken: "old-secondary" }
    ]);
    const account = configuredOAuthAccounts(provider)[1];
    const snapshot = providerWithFreshOAuthToken(provider, account, "fresh-secondary");

    expect(snapshot.oauthAccounts).toHaveLength(1);
    expect(snapshot.oauthAccounts?.[0].id).toBe("secondary");
    expect(snapshot.oauthAccounts?.[0].oauthAccessToken).toBe("fresh-secondary");
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
