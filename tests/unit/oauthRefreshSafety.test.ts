import { describe, expect, it } from "vitest";
import { oauthTokenIsExpired, oauthTokenNeedsRefresh } from "@/core/providerOAuthFlow";
import { sanitizeOAuthErrorBody } from "@/core/oauthPkce";

describe("OAuth refresh safety", () => {
  const now = Date.parse("2026-07-20T03:00:00.000Z");
  const preset = { refreshLeadMs: 10 * 60_000 };

  it("does not refresh an unknown-expiry token on every request", () => {
    expect(oauthTokenNeedsRefresh({
      oauthAccessToken: "token",
      oauthLastRefreshAt: new Date(now - 5 * 60_000).toISOString()
    }, preset, now)).toBe(false);
  });

  it("periodically refreshes unknown-expiry tokens when a refresh timestamp exists", () => {
    expect(oauthTokenNeedsRefresh({
      oauthAccessToken: "token",
      oauthLastRefreshAt: new Date(now - 46 * 60_000).toISOString()
    }, preset, now)).toBe(true);
  });

  it("detects an expired token and respects the refresh lead", () => {
    expect(oauthTokenIsExpired({ oauthTokenExpiresAt: new Date(now - 1).toISOString() }, now)).toBe(true);
    expect(oauthTokenNeedsRefresh({
      oauthAccessToken: "token",
      oauthTokenExpiresAt: new Date(now + 5 * 60_000).toISOString()
    }, preset, now)).toBe(true);
  });

  it("redacts OAuth credentials from upstream error bodies", () => {
    const secret = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const result = sanitizeOAuthErrorBody(JSON.stringify({
      error: "invalid_grant",
      error_description: `refresh_token=${secret}`
    }));
    expect(result).toContain("invalid_grant");
    expect(result).toContain("[redacted]");
    expect(result).not.toContain(secret);
  });
});
