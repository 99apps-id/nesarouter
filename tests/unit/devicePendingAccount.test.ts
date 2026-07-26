import { afterEach, describe, expect, it } from "vitest";
import {
  deleteDevicePending,
  deleteOAuthPending,
  readDevicePending,
  readOAuthPending,
  saveDevicePending,
  saveOAuthPending
} from "@/lib/oauthPendingPersistence";
import { getDb } from "@/lib/store";

describe("device OAuth pending account identity", () => {
  const providerId = "device-pending-account-regression";

  afterEach(async () => {
    await deleteDevicePending(providerId);
  });

  it("does not turn a new-flow pending id into a permanent account id", async () => {
    const pendingId = "new-regression-flow";
    await saveDevicePending(providerId, {
      deviceCode: "device-code",
      createdAt: new Date().toISOString()
    }, pendingId);

    const pending = await readDevicePending(providerId, pendingId);
    expect(pending).toBeTruthy();
    expect(pending?.accountId).toBeUndefined();
  });

  it("preserves the selected account id when reconnecting", async () => {
    const accountId = "oauth-existing-account";
    await saveDevicePending(providerId, {
      deviceCode: "device-code",
      createdAt: new Date().toISOString(),
      accountId
    }, accountId);

    const pending = await readDevicePending(providerId, accountId);
    expect(pending?.accountId).toBe(accountId);
  });
});

describe("OAuth pending persistence", () => {
  const state = "oauth-pending-regression";

  afterEach(async () => {
    await deleteOAuthPending(state);
    await deleteOAuthPending(`${state}-next`);
  });

  it("encrypts the PKCE verifier at rest and restores it through the interface", async () => {
    await saveOAuthPending(state, {
      providerId: "provider",
      codeVerifier: "sensitive-pkce-verifier",
      redirectUri: "http://localhost/callback",
      createdAt: new Date().toISOString()
    });

    const row = getDb()
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(`oauthPending:${state}`) as { value: string };
    expect(row.value).not.toContain("sensitive-pkce-verifier");
    await expect(readOAuthPending(state)).resolves.toMatchObject({
      providerId: "provider",
      codeVerifier: "sensitive-pkce-verifier"
    });
  });

  it("purges expired pending records when a new flow is saved", async () => {
    getDb()
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run(
        `oauthPending:${state}`,
        JSON.stringify({
          providerId: "provider",
          codeVerifier: "stale",
          redirectUri: "http://localhost/callback",
          createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString()
        })
      );

    await saveOAuthPending(`${state}-next`, {
      providerId: "provider",
      codeVerifier: "fresh",
      redirectUri: "http://localhost/callback",
      createdAt: new Date().toISOString()
    });

    await expect(readOAuthPending(state)).resolves.toBeNull();
  });
});
