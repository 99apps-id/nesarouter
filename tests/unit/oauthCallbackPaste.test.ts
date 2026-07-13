import { describe, expect, it } from "vitest";
import { parseOAuthCallbackPaste } from "@/core/oauthCallbackPaste";

describe("parseOAuthCallbackPaste", () => {
  it("parses a Codex/9router localhost callback URL", () => {
    const parsed = parseOAuthCallbackPaste(
      "http://localhost:1455/auth/callback?code=abc123&scope=openid&state=prov:xyz",
      "fallback"
    );
    expect(parsed).toEqual({ code: "abc123", state: "prov:xyz" });
  });

  it("parses Claude code#state paste", () => {
    expect(parseOAuthCallbackPaste("tokencode#mystate")).toEqual({ code: "tokencode", state: "mystate" });
  });

  it("uses fallback state for bare code", () => {
    expect(parseOAuthCallbackPaste("onlycode", "session-state")).toEqual({
      code: "onlycode",
      state: "session-state"
    });
  });
});
