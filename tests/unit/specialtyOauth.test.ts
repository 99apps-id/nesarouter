import { describe, expect, it } from "vitest";
import { normalizeClineAccessToken } from "@/core/providers/openaiCompatible";
import { parseOAuthCallbackPaste } from "@/core/oauthCallbackPaste";
import { buildAuthorizeUrl, generatePkce } from "@/core/oauthPkce";
import { getPreset, usesOAuthDeviceFlow } from "@/core/oauthProviderPresets";
import { providerIdentity } from "@/lib/providerIdentity";

describe("specialty OAuth helpers", () => {
  it("normalizes Cline WorkOS bearer tokens", () => {
    expect(normalizeClineAccessToken("abc", "cline")).toBe("workos:abc");
    expect(normalizeClineAccessToken("workos:abc", "cline")).toBe("workos:abc");
    expect(normalizeClineAccessToken("abc", "anthropic_claude")).toBe("abc");
  });

  it("parses Kimchi token callback URLs", () => {
    const parsed = parseOAuthCallbackPaste(
      "http://127.0.0.1:51888/callback?token=kimchi-tok&state=oauth-kimchi:abc"
    );
    expect(parsed.code).toBe("kimchi-tok");
    expect(parsed.state).toContain("oauth-kimchi");
  });

  it("builds Kimchi and iFlow authorize URLs", () => {
    const kimchi = getPreset("kimchi")!;
    const iflow = getPreset("iflow")!;
    expect(buildAuthorizeUrl(kimchi, "http://127.0.0.1:51888/callback", "st", "ch")).toContain(
      "app.kimchi.dev/cli-auth"
    );
    expect(buildAuthorizeUrl(iflow, "http://127.0.0.1:51889/callback", "st", "ch")).toContain("iflow.cn/oauth");
    expect(buildAuthorizeUrl(iflow, "http://127.0.0.1:51889/callback", "st", "ch")).toContain("client_id=");
  });

  it("flags specialty device flows", () => {
    expect(usesOAuthDeviceFlow(getPreset("qwen_code"))).toBe(true);
    expect(usesOAuthDeviceFlow(getPreset("grok_cli"))).toBe(true);
    expect(usesOAuthDeviceFlow(getPreset("codebuddy_cn"))).toBe(true);
    expect(usesOAuthDeviceFlow(getPreset("kilocode"))).toBe(true);
    expect(usesOAuthDeviceFlow(getPreset("kimchi"))).toBe(false);
    expect(usesOAuthDeviceFlow(getPreset("anthropic_claude"))).toBe(false);
  });

  it("generates PKCE for Qwen device flow", () => {
    const pkce = generatePkce();
    expect(pkce.verifier.length).toBeGreaterThan(20);
    expect(pkce.challenge.length).toBeGreaterThan(20);
  });

  it("resolves OAuth specialty brand icons", () => {
    expect(providerIdentity({ id: "oauth-qwen-code", name: "Qwen Code" }).iconPath).toBe("/icons/qwen.png");
    expect(providerIdentity({ id: "oauth-grok-cli", name: "Grok CLI" }).iconPath).toBe("/icons/xai.png");
    expect(providerIdentity({ id: "oauth-kimchi", name: "Kimchi" }).iconPath).toBe("/icons/kimchi.png");
    expect(providerIdentity({ id: "oauth-iflow", name: "iFlow" }).iconPath).toBe("/icons/iflow.png");
    expect(providerIdentity({ id: "oauth-codebuddy-cn", name: "CodeBuddy CN" }).iconPath).toBe(
      "/icons/codebuddy-cn.png"
    );
    expect(providerIdentity({ id: "oauth-cline", name: "Cline" }).iconPath).toBe("/icons/cline.png");
    expect(providerIdentity({ id: "oauth-kilocode", name: "Kilo Code" }).iconPath).toBe("/icons/kilocode.png");
  });
});
