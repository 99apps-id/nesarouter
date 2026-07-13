import { describe, expect, it } from "vitest";
import { isOAuthAccountFatalError, isOAuthAccountRoutable } from "@/core/oauthAccountHealth";
import { UpstreamProviderError } from "@/core/providers/shared";

describe("oauth account health", () => {
  it("treats auth and quota errors as fatal", () => {
    expect(isOAuthAccountFatalError(new UpstreamProviderError("401 unauthorized", 401))).toBe(true);
    expect(isOAuthAccountFatalError(new UpstreamProviderError("insufficient_quota billing", 429))).toBe(true);
    expect(isOAuthAccountFatalError(new UpstreamProviderError("rate limit", 429))).toBe(false);
  });

  it("excludes error accounts from routable pool", () => {
    expect(isOAuthAccountRoutable({ id: "a", oauthAccessToken: "x", connectionStatus: "connected" })).toBe(true);
    expect(isOAuthAccountRoutable({ id: "a", oauthAccessToken: "x", connectionStatus: "error" })).toBe(false);
  });
});
