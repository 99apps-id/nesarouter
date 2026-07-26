import { afterEach, describe, expect, it } from "vitest";
import { ProviderConfig } from "@/core/types";
import {
  clearOAuthAccount,
  markOAuthAccountConnection,
  saveProviderOAuthTokens
} from "@/lib/providerOAuthPersistence";
import { deleteProvider, getDb, readProviderById, updateProvider } from "@/lib/store";

const providerId = "test-provider-oauth-persistence";

function oauthProvider(): ProviderConfig {
  return {
    id: providerId,
    name: "OAuth persistence test",
    type: "openai_responses",
    tier: "premium",
    status: "disabled",
    baseUrl: "https://example.test",
    apiKey: "",
    model: "gpt-test",
    priority: 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    oauthProfile: "openai_codex"
  };
}

afterEach(async () => {
  await deleteProvider(providerId);
});

describe("provider OAuth persistence", () => {
  it("encrypts credentials and keeps the primary legacy columns synchronized", async () => {
    await updateProvider(oauthProvider());
    const primaryId = await saveProviderOAuthTokens(providerId, {
      accessToken: "primary-access-secret",
      refreshToken: "primary-refresh-secret"
    });

    const provider = await readProviderById(providerId);
    expect(provider?.status).toBe("active");
    expect(provider?.connectionStatus).toBe("connected");
    expect(provider?.oauthAccounts).toMatchObject([
      {
        id: primaryId,
        oauthAccessToken: "primary-access-secret",
        oauthRefreshToken: "primary-refresh-secret",
        connectionStatus: "connected"
      }
    ]);
    expect(provider?.oauthAccessToken).toBe("primary-access-secret");
    expect(provider?.oauthRefreshToken).toBe("primary-refresh-secret");

    const stored = getDb()
      .prepare(
        "SELECT oauth_accounts, oauth_access_token_encrypted, oauth_refresh_token_encrypted FROM providers WHERE id = ?"
      )
      .get(providerId) as {
      oauth_accounts: string;
      oauth_access_token_encrypted: string;
      oauth_refresh_token_encrypted: string;
    };
    expect(JSON.stringify(stored)).not.toContain("primary-access-secret");
    expect(JSON.stringify(stored)).not.toContain("primary-refresh-secret");
  });

  it("preserves aggregate routing status while another account remains usable", async () => {
    await updateProvider(oauthProvider());
    const primaryId = await saveProviderOAuthTokens(providerId, { accessToken: "primary-token" });
    const secondaryId = await saveProviderOAuthTokens(
      providerId,
      { accessToken: "secondary-token" },
      { createNew: true, accountName: "Secondary" }
    );

    await markOAuthAccountConnection(providerId, primaryId, false, "Subscription missing", {
      status: "no_subscription"
    });
    let provider = await readProviderById(providerId);
    expect(provider?.connectionStatus).toBe("connected");
    expect(provider?.oauthAccounts?.find((account) => account.id === primaryId)).toMatchObject({
      connectionStatus: "no_subscription",
      lastError: "Subscription missing"
    });

    await clearOAuthAccount(providerId, secondaryId);
    provider = await readProviderById(providerId);
    expect(provider?.connectionStatus).toBe("no_subscription");
    expect(provider?.oauthAccounts).toHaveLength(1);
    expect(provider?.oauthAccessToken).toBe("primary-token");
  });

  it("rejects a stale account target instead of silently creating it", async () => {
    await updateProvider(oauthProvider());

    await expect(
      saveProviderOAuthTokens(
        providerId,
        { accessToken: "unexpected-token" },
        { accountId: "missing-account" }
      )
    ).rejects.toThrow("OAuth account no longer exists");
    expect((await readProviderById(providerId))?.oauthAccounts).toBeUndefined();
  });
});
