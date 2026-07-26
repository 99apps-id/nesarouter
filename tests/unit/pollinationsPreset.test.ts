import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { providerIdentity } from "@/lib/providerIdentity";
import { providerPresets, providerPresetGroups } from "@/lib/providerPresets";
import { ProviderSchema, toProviderConfig } from "@/lib/validation";
import { getDb, readProviderById, seedMissingProviders } from "@/lib/store";

describe("Pollinations provider preset", () => {
  it("ships as a disabled metered OpenAI-compatible provider on gen.pollinations.ai", () => {
    const provider = providerPresets.find((item) => item.id === "pollinations-free");
    expect(provider).toMatchObject({
      name: "Pollinations",
      type: "openai_compatible",
      tier: "cheap",
      status: "disabled",
      baseUrl: "https://gen.pollinations.ai/v1",
      model: "openai",
      inputCostPerMTok: 0.15,
      outputCostPerMTok: 0.9375
    });
    expect(provider?.models).toContain("openai-fast");
    expect(providerPresetGroups.find((g) => g.label === "Free / local")?.ids).not.toContain("pollinations-free");
    expect(providerPresetGroups.find((g) => g.label === "Global API key")?.ids).toContain("pollinations-free");
  });

  it("repairs the zero-cost v0.1.48 seed without overwriting configured credentials", async () => {
    const database = getDb();
    database.prepare(`
      UPDATE providers
      SET tier = 'free',
          input_cost_per_mtok = 0,
          output_cost_per_mtok = 0,
          api_key_encrypted = 'operator-key'
      WHERE id = 'pollinations-free'
    `).run();

    seedMissingProviders();
    const provider = await readProviderById("pollinations-free");
    expect(provider).toMatchObject({
      tier: "cheap",
      inputCostPerMTok: 0.15,
      outputCostPerMTok: 0.9375,
      apiKey: "operator-key"
    });
  });

  it("does not ship broken OmniRoute openai stubs that need custom executors", () => {
    for (const id of ["qoder-free", "agentrouter-free", "zenmux-free", "felo-free"]) {
      expect(providerPresets.find((item) => item.id === id)).toBeUndefined();
    }
  });
});

describe("OmniRoute-related provider identity", () => {
  it("resolves Pollinations / Qoder / AgentRouter / ZenMux / Felo icons", () => {
    const cases = [
      { id: "pollinations-free", name: "Pollinations", model: "openai", key: "pollinations", icon: "/icons/pollinations.svg" },
      { id: "qoder", name: "Qoder AI", model: "openai", key: "qoder", icon: "/icons/qoder.svg" },
      { id: "agentrouter", name: "AgentRouter", model: "gemini", key: "agentrouter", icon: "/icons/agentrouter.png" },
      { id: "zenmux", name: "ZenMux", model: "grok", key: "zenmux", icon: "/icons/zenmux.svg" },
      { id: "felo-web", name: "Felo Chat", model: "openai", key: "felo", icon: "/icons/felo.svg" }
    ];
    for (const item of cases) {
      const identity = providerIdentity({ id: item.id, name: item.name, model: item.model });
      expect(identity.key).toBe(item.key);
      expect(identity.iconPath).toBe(item.icon);
      expect(fs.existsSync(path.join(process.cwd(), "public", identity.iconPath!))).toBe(true);
    }
  });
});

describe("ProviderSchema hardening", () => {
  it("strips secret fields and maps to a store-safe ProviderConfig", () => {
    const parsed = ProviderSchema.safeParse({
      id: "custom",
      name: "Custom",
      baseUrl: "https://example.com/v1",
      model: "gpt-test",
      apiKey: "sk-should-be-stripped",
      oauthAccessToken: "secret",
      inputCostPerMTok: 1.5,
      outputCostPerMTok: 2,
      oauthProfile: "anthropic_claude"
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect("apiKey" in parsed.data).toBe(false);
    const config = toProviderConfig(parsed.data);
    expect(config.apiKey).toBeUndefined();
    expect(config.inputCostPerMTok).toBe(1.5);
    expect(config.outputCostPerMTok).toBe(2);
    expect(config.oauthProfile).toBe("anthropic_claude");
  });

  it("accepts legacy lowercase cost field names and coerces blank numbers", () => {
    const parsed = ProviderSchema.safeParse({
      id: "legacy",
      name: "Legacy",
      baseUrl: "http://localhost:11434/v1",
      model: "llama3.1",
      inputCostPerMtok: "0.5",
      outputCostPerMtok: "",
      priority: "12"
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const config = toProviderConfig(parsed.data);
    expect(config.inputCostPerMTok).toBe(0.5);
    expect(config.outputCostPerMTok).toBe(0);
    expect(config.priority).toBe(12);
  });

  it("rejects invalid baseUrl with a clear message", () => {
    const parsed = ProviderSchema.safeParse({
      id: "bad",
      name: "Bad",
      baseUrl: "not-a-url",
      model: "x"
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toMatch(/valid URL/i);
  });
});
