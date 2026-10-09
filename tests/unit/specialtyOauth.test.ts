import { describe, expect, it } from "vitest";
import { normalizeClineAccessToken } from "@/core/providers/openaiCompatible";
import { parseOAuthCallbackPaste } from "@/core/oauthCallbackPaste";
import { buildAuthorizeUrl, generatePkce, startDeviceFlow } from "@/core/oauthPkce";
import { getPreset, OAUTH_PRESETS, usesOAuthDeviceFlow } from "@/core/oauthProviderPresets";
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

  it("resolves a Muse provider without inventing an icon asset", () => {
    const identity = providerIdentity({ id: "oauth-muse", name: "Meta Muse Code" });
    expect(identity.key).toBe("muse");
    expect(identity.label).toBe("MU");
    expect(identity.iconPath).toBeUndefined();
  });
});

describe("Meta Muse Code preset", () => {
  const muse = OAUTH_PRESETS.muse;

  it("is registered as a device flow speaking the Responses API", () => {
    expect(muse.displayName).toBe("Meta Muse Code");
    expect(muse.deviceFlow).toBe(true);
    expect(usesOAuthDeviceFlow(muse)).toBe(true);
    expect(muse.providerType).toBe("openai_responses");
    expect(muse.deviceCodeUrl).toBe("https://auth.meta.com/oidc/device/authorization/");
    expect(muse.tokenUrl).toBe("https://auth.meta.com/oidc/device/token/");
    expect(muse.museMintUrl).toBe("https://api.meta.ai/muse-code/key");
    expect(muse.baseUrl).toBe("https://api.meta.ai/v1/responses");
  });

  it("carries the Muse identity headers Meta gates on", () => {
    expect(muse.upstreamHeaders?.["User-Agent"]).toContain("muse-build/");
    expect(muse.upstreamHeaders?.["X-Client-Id"]).toBe("tbh:tui");
    expect(muse.upstreamHeaders?.["x-api-version"]).toBe("1.0.0");
  });

  it("offers the Muse Spark family as models", () => {
    expect(muse.defaultModel).toBe("muse-spark-1.3");
    expect(muse.models).toContain("muse-spark-1.3");
    expect(muse.models).toContain("muse-spark-1.2-contributor");
  });
});

describe("device code start", () => {
  it("omits an empty scope instead of sending scope=", async () => {
    const muse = OAUTH_PRESETS.muse;
    let sent = "";
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent = String(init.body);
      return new Response(JSON.stringify({ device_code: "d", user_code: "u" }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      await startDeviceFlow(muse);
    } finally {
      globalThis.fetch = original;
    }
    expect(sent).toContain("client_id=");
    expect(sent).not.toContain("scope=");
  });
});
