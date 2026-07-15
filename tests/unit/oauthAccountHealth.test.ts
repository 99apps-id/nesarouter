import { describe, expect, it } from "vitest";
import { isOAuthAccountRoutable, oauthAccountHasRequiredMaterial, oauthAccountStatusLabel } from "@/core/oauthAccountHealth";
import { OAuthAccount, ProviderConfig } from "@/core/types";

function account(partial: Partial<OAuthAccount> = {}): OAuthAccount {
  return {
    id: "a1",
    name: "Account 1",
    oauthAccessToken: "tok",
    connectionStatus: "connected",
    ...partial
  };
}

function provider(partial: Partial<ProviderConfig> = {}): Pick<ProviderConfig, "oauthProfile" | "type"> {
  return {
    oauthProfile: "openai_codex",
    type: "openai_responses",
    ...partial
  };
}

describe("oauth account health", () => {
  it("treats standard OAuth token+connected as routable", () => {
    expect(isOAuthAccountRoutable(account(), Date.now(), provider())).toBe(true);
  });

  it("requires Cursor machine id for routability", () => {
    const cursor = provider({ oauthProfile: "cursor", type: "cursor" });
    const withoutMachine = account();
    expect(oauthAccountHasRequiredMaterial(withoutMachine, cursor)).toBe(false);
    expect(isOAuthAccountRoutable(withoutMachine, Date.now(), cursor)).toBe(false);
    expect(oauthAccountStatusLabel(withoutMachine, cursor)).toBe("error");

    const withMachine = account({ oauthMachineId: "machine-1" });
    expect(isOAuthAccountRoutable(withMachine, Date.now(), cursor)).toBe(true);
  });

  it("skips error and no_subscription accounts", () => {
    expect(isOAuthAccountRoutable(account({ connectionStatus: "error" }), Date.now(), provider())).toBe(false);
    expect(isOAuthAccountRoutable(account({ connectionStatus: "no_subscription" }), Date.now(), provider())).toBe(false);
  });

  it("allows github_copilot with either github or copilot token", () => {
    const copilot = provider({ oauthProfile: "github_copilot", type: "github_copilot" });
    expect(isOAuthAccountRoutable(account({ oauthAccessToken: "gho", oauthCopilotToken: undefined }), Date.now(), copilot)).toBe(true);
    expect(
      isOAuthAccountRoutable(
        account({ oauthAccessToken: undefined, oauthCopilotToken: "copilot_session" }),
        Date.now(),
        copilot
      )
    ).toBe(true);
  });
});
