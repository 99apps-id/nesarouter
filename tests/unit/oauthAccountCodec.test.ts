import { describe, expect, it } from "vitest";
import {
  legacyOAuthAccountFromRow,
  mergeIncomingOAuthAccounts,
  parseOAuthAccounts,
  serializeOAuthAccounts
} from "@/lib/oauthAccountCodec";

describe("OAuth account codec", () => {
  it("encrypts account credentials at rest and restores all credential fields", () => {
    const serialized = serializeOAuthAccounts([{
      id: "account-1",
      name: "Primary",
      oauthAccessToken: "access-secret",
      oauthRefreshToken: "refresh-secret",
      oauthCopilotToken: "copilot-secret",
      oauthDeviceClientSecret: "device-secret",
      oauthMachineId: "machine-id",
      connectionStatus: "connected"
    }]);

    expect(serialized).not.toContain("access-secret");
    expect(serialized).not.toContain("refresh-secret");
    expect(serialized).not.toContain("copilot-secret");
    expect(serialized).not.toContain("device-secret");
    expect(parseOAuthAccounts(serialized)).toEqual([{
      id: "account-1",
      name: "Primary",
      oauthAccessToken: "access-secret",
      oauthRefreshToken: "refresh-secret",
      oauthTokenExpiresAt: undefined,
      oauthLastRefreshAt: undefined,
      oauthCopilotToken: "copilot-secret",
      oauthCopilotTokenExpiresAt: undefined,
      oauthProjectId: undefined,
      oauthDeviceClientId: undefined,
      oauthDeviceClientSecret: "device-secret",
      oauthMachineId: "machine-id",
      oauthProfileArn: undefined,
      connectionStatus: "connected",
      lastError: undefined,
      lastCheckedAt: undefined,
      rateLimitedUntil: undefined,
      createdAt: undefined
    }]);
  });

  it("preserves stored secrets when the admin interface submits redacted placeholders", () => {
    const existing = serializeOAuthAccounts([{
      id: "account-1",
      oauthAccessToken: "access-secret",
      oauthRefreshToken: "refresh-secret",
      oauthMachineId: "machine-id"
    }]);

    expect(mergeIncomingOAuthAccounts([{
      id: "account-1",
      name: "Renamed",
      oauthAccessToken: "********",
      oauthRefreshToken: "[REDACTED]",
      oauthMachineId: "********"
    }], existing)).toMatchObject([{
      id: "account-1",
      name: "Renamed",
      oauthAccessToken: "access-secret",
      oauthRefreshToken: "refresh-secret",
      oauthMachineId: "machine-id"
    }]);
  });

  it("converts legacy encrypted columns into the multi-account shape", () => {
    const serialized = serializeOAuthAccounts([{ id: "source", oauthAccessToken: "legacy-access" }]);
    const stored = JSON.parse(serialized)[0];
    expect(legacyOAuthAccountFromRow({
      oauth_access_token_encrypted: stored.oauthAccessTokenEncrypted,
      connection_status: "connected"
    })).toMatchObject({
      id: "legacy",
      name: "Account 1",
      oauthAccessToken: "legacy-access",
      connectionStatus: "connected"
    });
  });
});
