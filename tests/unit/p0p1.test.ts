import { describe, expect, it } from "vitest";
import { resolveModelAlias } from "@/core/aliases";
import { authorizeRequest } from "@/core/auth";
import { defaultStore } from "@/lib/defaults";
import { isRedactedSecret } from "@/lib/crypto";
import { compressWithPxpipe } from "@/core/pxpipe";
import { redactCacheEntryForClient, redactProviderForClient } from "@/lib/providerRedact";
import { ProviderConfig } from "@/core/types";

describe("aliases", () => {
  it("resolves alias to target", () => {
    expect(resolveModelAlias([{ id: "1", alias: "fast", target: "gpt-4o-mini" }], "fast")).toBe("gpt-4o-mini");
    expect(resolveModelAlias([{ id: "1", alias: "fast", target: "gpt-4o-mini" }], "other")).toBe("other");
  });
});

describe("authorizeRequest", () => {
  it("rejects when no local API keys are configured", () => {
    const store = { ...defaultStore, localApiKeys: [] };
    const request = new Request("http://localhost/v1/models", { headers: { authorization: "Bearer anything" } });
    expect(authorizeRequest(store, request)).toBe(false);
  });

  it("accepts a matching bearer token", () => {
    const store = { ...defaultStore, localApiKeys: ["secret-key"] };
    const request = new Request("http://localhost/v1/models", { headers: { authorization: "Bearer secret-key" } });
    expect(authorizeRequest(store, request)).toBe(true);
  });
});

describe("isRedactedSecret", () => {
  it("detects masked values", () => {
    expect(isRedactedSecret("********")).toBe(true);
    expect(isRedactedSecret("real-key")).toBe(false);
  });
});

describe("provider redaction", () => {
  it("masks device client secret and machine id", () => {
    const provider = {
      id: "oauth-kiro",
      name: "Kiro",
      type: "kiro",
      tier: "paid",
      status: "active",
      baseUrl: "https://example.com",
      apiKey: "sk-live",
      model: "model",
      priority: 1,
      inputCostPerMTok: 0,
      outputCostPerMTok: 0,
      oauthDeviceClientSecret: "device-secret",
      oauthMachineId: "machine-id",
      oauthAccessToken: "access"
    } as unknown as ProviderConfig;
    const redacted = redactProviderForClient(provider);
    expect(redacted.apiKey).toBe("********");
    expect(redacted.oauthDeviceClientSecret).toBe("********");
    expect(redacted.oauthMachineId).toBe("********");
    expect(redacted.oauthAccessToken).toBe("********");
  });

  it("omits cache response bodies", () => {
    const meta = redactCacheEntryForClient({
      key: "abc",
      createdAt: "2026-01-01T00:00:00.000Z",
      providerId: "p1",
      model: "m",
      inputTokens: 1,
      outputTokens: 2,
      savedCostUsd: 0.01,
      response: { choices: [{ message: { content: "secret" } }] }
    });
    expect(meta).not.toHaveProperty("response");
    expect(meta.key).toBe("abc");
  });
});

describe("pxpipe-lite", () => {
  it("no-ops when disabled", async () => {
    const body = { messages: [{ role: "tool", content: "x".repeat(500) }] };
    const result = await compressWithPxpipe(body, false);
    expect(result.applied).toBe(false);
  });

  it("collapses long tool messages when enabled", async () => {
    const body = { messages: [{ role: "tool", content: ("line   \n\n\n").repeat(80) }] };
    const result = await compressWithPxpipe(body, true);
    expect(result.applied).toBe(true);
    expect(result.savedChars).toBeGreaterThan(0);
  });
});
