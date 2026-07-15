import { describe, expect, it } from "vitest";
import { buildCompressEndpoint } from "@/core/headroomCompress";
import { buildCliToolConfig } from "@/lib/cliToolConfig";
import { ensureMimoSystemPrompt } from "@/core/mimoFreeAuth";
import { chooseProvider } from "@/core/router";
import { defaultStore } from "@/lib/defaults";
import { NesaStore, ProviderConfig } from "@/core/types";

function provider(partial: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: partial.id ?? "p",
    name: partial.name ?? "P",
    type: "openai_compatible",
    tier: partial.tier ?? "free",
    status: "active",
    baseUrl: "http://example/v1",
    apiKey: "key",
    model: partial.model ?? "m",
    priority: partial.priority ?? 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    ...partial
  };
}

describe("headroom compress URL", () => {
  it("does not double /v1 when base already ends with /v1", () => {
    expect(buildCompressEndpoint("http://localhost:8787/v1")).toBe("http://localhost:8787/v1/compress");
    expect(buildCompressEndpoint("http://localhost:8787")).toBe("http://localhost:8787/v1/compress");
    expect(buildCompressEndpoint("http://localhost:8787/v1/compress")).toBe("http://localhost:8787/v1/compress");
  });
});

describe("CLI config URLs", () => {
  it("points Codex at /v1", () => {
    const cfg = buildCliToolConfig("codex", "http://localhost:20129", "nesa-key", "auto");
    expect(cfg.env.OPENAI_BASE_URL).toBe("http://localhost:20129/v1");
    expect(cfg.files[0].content).toContain('base_url = "http://localhost:20129/v1"');
  });

  it("does not append /v1 twice", () => {
    const cfg = buildCliToolConfig("generic", "http://localhost:20129/v1", "nesa-key", "auto");
    expect(cfg.env.OPENAI_BASE_URL).toBe("http://localhost:20129/v1");
  });

  it("keeps OpenClaw baseUrl at a single /v1", () => {
    const fromRoot = buildCliToolConfig("openclaw", "http://localhost:20129", "nesa-key", "auto");
    expect(fromRoot.files[0].content).toContain('"baseUrl": "http://127.0.0.1:20129/v1"');
    const fromV1 = buildCliToolConfig("openclaw", "http://localhost:20129/v1", "nesa-key", "auto");
    expect(fromV1.files[0].content).toContain('"baseUrl": "http://127.0.0.1:20129/v1"');
    expect(fromV1.files[0].content).not.toContain("/v1/v1");
  });

  it("writes Hermes OPENAI_BASE_URL into .env", () => {
    const cfg = buildCliToolConfig("hermes", "http://localhost:20129", "nesa-key", "auto");
    expect(cfg.env.OPENAI_BASE_URL).toBe("http://localhost:20129/v1");
    expect(cfg.files.some((f) => f.path.endsWith(".env") && f.content.includes("OPENAI_BASE_URL="))).toBe(true);
  });
});

describe("MiMo free helpers", () => {
  it("prepends MiMoCode system prompt once", () => {
    const once = ensureMimoSystemPrompt([{ role: "user", content: "hi" }]);
    expect(once[0].role).toBe("system");
    expect(String(once[0].content)).toContain("MiMoCode");
    const twice = ensureMimoSystemPrompt(once);
    expect(twice.filter((m) => m.role === "system")).toHaveLength(1);
  });
});

describe("router multi-provider model fallback", () => {
  it("tries the next provider advertising the same model after exclusion", () => {
    const store: NesaStore = {
      ...defaultStore,
      providers: [
        provider({ id: "a", model: "shared", models: ["shared"], priority: 1 }),
        provider({ id: "b", model: "shared", models: ["shared"], priority: 2 })
      ]
    };
    const first = chooseProvider(store, { model: "shared", messages: [] });
    expect(first.provider.id).toBe("a");
    const second = chooseProvider(store, { model: "shared", messages: [] }, ["a"]);
    expect(second.provider.id).toBe("b");
    expect(second.provider.model).toBe("shared");
  });
});
