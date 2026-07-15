import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GeminiCliExecutor } from "@/core/providers/geminiCli";
import { ProviderConfig } from "@/core/types";

function provider(partial: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "oauth-gemini-cli",
    name: "Gemini CLI (Google subscription)",
    type: "gemini_cli",
    tier: "premium",
    status: "active",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
    apiKey: "",
    model: "gemini-3-pro-preview",
    priority: 12,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    oauthProfile: "gemini_cli",
    oauthAccessToken: "ya29.test-token",
    ...partial
  };
}

describe("GeminiCliExecutor.validate", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("marks connected via loadCodeAssist without calling generateContent", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(":loadCodeAssist")) {
        return new Response(
          JSON.stringify({
            cloudaicompanionProject: { id: "proj-abc" },
            currentTier: { id: "FREE" }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes(":generateContent")) {
        return new Response("should not generate", { status: 500 });
      }
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await new GeminiCliExecutor().validate(provider());
    expect(result.message).toMatch(/accepted/i);
    expect(result.message).toMatch(/proj-abc/);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes(":generateContent"))).toBe(false);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes(":loadCodeAssist"))).toBe(true);
  });

  it("still accepts token when project id is missing after loadCodeAssist", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(":loadCodeAssist")) {
        return new Response(JSON.stringify({ currentTier: { id: "LEGACY" } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (url.includes(":onboardUser")) {
        return new Response("{}", { status: 403 });
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const result = await new GeminiCliExecutor().validate(provider({ oauthProjectId: undefined }));
    expect(result.message).toMatch(/token accepted/i);
  });
});
