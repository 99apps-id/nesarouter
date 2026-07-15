import { describe, expect, it } from "vitest";
import {
  flattenOpenAiMessagesForGrok,
  GROK_WEB_MODEL_MAP,
  normalizeGrokSsoCookie
} from "@/core/providers/grokWeb";
import { claudeOnVertexUrl, encodeVertexClaudeModelId, isVertexClaudeProvider } from "@/core/providers/vertex";
import {
  extractCloudflareAccountId,
  isCloudflareWorkersAiProvider,
  withCloudflareAccountId
} from "@/lib/cloudflareWorkersAi";
import { providerIdentity } from "@/lib/providerIdentity";
import { PROVIDER_PREFIXES } from "@/core/providerPrefixes";

describe("cloudflare workers ai helpers", () => {
  it("rewrites account id in base url", () => {
    const url = withCloudflareAccountId(
      "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1",
      "abc123"
    );
    expect(url).toContain("/accounts/abc123/");
    expect(extractCloudflareAccountId(url)).toBe("abc123");
    expect(isCloudflareWorkersAiProvider({ id: "cloudflare-workers-ai", baseUrl: url })).toBe(true);
  });
});

describe("grok web helpers", () => {
  it("normalizes sso cookie paste formats", () => {
    expect(normalizeGrokSsoCookie("sso=token123")).toBe("token123");
    expect(normalizeGrokSsoCookie("token123")).toBe("token123");
    expect(normalizeGrokSsoCookie("Cookie: sso=abc; other=1")).toBe("abc");
  });

  it("flattens messages and maps models", () => {
    expect(
      flattenOpenAiMessagesForGrok([
        { role: "system", content: "be brief" },
        { role: "user", content: "hi" }
      ])
    ).toBe("system: be brief\n\nhi");
    expect(GROK_WEB_MODEL_MAP["grok-4.1-fast"]?.modelMode).toBe("MODEL_MODE_FAST");
  });

  it("resolves grok-web identity and prefix", () => {
    expect(providerIdentity({ id: "grok-web", name: "Grok Web" }).key).toBe("grok-web");
    expect(PROVIDER_PREFIXES.gw).toBe("grok-web");
  });
});

describe("claude on vertex", () => {
  it("detects claude providers and builds rawPredict urls", () => {
    expect(isVertexClaudeProvider({ id: "vertex-claude", name: "V", type: "vertex", model: "claude-sonnet-4-6" } as any)).toBe(true);
    expect(encodeVertexClaudeModelId("claude-sonnet-4-5@20250929")).toContain("@");
    const url = claudeOnVertexUrl({ projectId: "proj", location: "global" }, "claude-opus-4-8", true);
    expect(url).toBe(
      "https://aiplatform.googleapis.com/v1/projects/proj/locations/global/publishers/anthropic/models/claude-opus-4-8:streamRawPredict"
    );
    expect(claudeOnVertexUrl({ projectId: "proj", location: "us-east5" }, "claude-opus-4-8", false)).toBe(
      "https://us-east5-aiplatform.googleapis.com/v1/projects/proj/locations/us-east5/publishers/anthropic/models/claude-opus-4-8:rawPredict"
    );
    expect(PROVIDER_PREFIXES.vxc).toBe("vertex-claude");
  });
});
