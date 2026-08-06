import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyCliConfigFile, applyCliToolConfigLocal, deepMergeJson, mergeHermesModelYaml, mergeTomlConfig, resetCliToolConfigLocal } from "@/lib/cliLocalApply";
import { buildCliInstallScripts, buildCliToolConfig, resolveCliModel } from "@/lib/cliToolConfig";
import { defaultStore } from "@/lib/defaults";

describe("cli tool config", () => {
  it("resolves combo and auto model targets", () => {
    const store = {
      ...defaultStore,
      combos: [{ id: "dev", name: "dev-chain", providerIds: ["a"], strategy: "fallback" as const }],
      aliases: [{ id: "1", alias: "fast", target: "gpt-4o-mini" }]
    };
    expect(resolveCliModel(store, "auto").model).toBe("auto");
    expect(resolveCliModel(store, "combo:dev-chain").model).toBe("dev-chain");
    expect(resolveCliModel(store, "alias:fast").model).toBe("fast");
  });

  it("uses ANTHROPIC_AUTH_TOKEN for Claude Code gateway override", () => {
    const config = buildCliToolConfig("claude-code", "http://localhost:20129", "nesa_test", "auto");
    expect(config.env.ANTHROPIC_AUTH_TOKEN).toBe("nesa_test");
    expect(config.env.ANTHROPIC_BASE_URL).toBe("http://localhost:20129/v1");
    expect(config.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(config.files[0]?.content).toContain("ANTHROPIC_AUTH_TOKEN");
  });

  it("builds install scripts that merge JSON instead of blind overwrite", () => {
    const config = buildCliToolConfig("claude-code", "http://localhost:20129", "nesa_test", "auto");
    const scripts = buildCliInstallScripts(config);
    expect(scripts.bash).toContain("$HOME/.claude/settings.json");
    expect(scripts.bash).toContain("merge");
    expect(scripts.powershell).toContain("USERPROFILE");
    expect(scripts.powershell).toContain("NESA_PATCH");
    expect(scripts.bash).toContain("nesa_test");
    expect(scripts.bash).toContain(".config/nesarouter/cli.env");
    expect(scripts.bash).toContain("$HOME/.profile");
  });

  it("uses Qwen's OpenAI provider schema", () => {
    const config = buildCliToolConfig("qwen-code", "http://localhost:20129", "nesa_test", "auto");
    const json = JSON.parse(config.files[0]!.content);
    expect(json.modelProviders.openai[0]).toMatchObject({ id: "auto", baseUrl: "http://localhost:20129/v1", envKey: "NESA_ROUTER_API_KEY" });
    expect(json.security.auth.selectedType).toBe("openai");
    expect(json.env.NESA_ROUTER_API_KEY).toBe("nesa_test");
  });
});

describe("cli local apply merge", () => {
  const tmpDir = path.join(os.tmpdir(), `nesa-cli-apply-${process.pid}`);
  const settingsPath = path.join(tmpDir, "settings.json");

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("deep-merges env without wiping unrelated settings", () => {
    expect(deepMergeJson({ keep: true, env: { OTHER: "1" } }, { env: { ANTHROPIC_BASE_URL: "x" } })).toEqual({
      keep: true,
      env: { OTHER: "1", ANTHROPIC_BASE_URL: "x" }
    });
  });

  it("merges Codex provider without deleting unrelated TOML settings", () => {
    const existing = `model = "old"\napproval_policy = "on-request"\n\n[model_providers.other]\nname = "Other"\n`;
    const patch = buildCliToolConfig("codex", "http://127.0.0.1:20129", "nesa_secret", "auto").files[0]!.content;
    const merged = mergeTomlConfig(existing, patch);
    expect(merged).toContain('approval_policy = "on-request"');
    expect(merged).toContain("[model_providers.other]");
    expect(merged).toContain('model_provider = "nesa"');
    expect(merged).toContain('experimental_bearer_token = "nesa_secret"');
    expect(merged.match(/^model\s*=/gm)).toHaveLength(1);
  });

  it("applies Codex TOML merge locally and preserves existing settings", () => {
    const codexPath = path.join(tmpDir, "config.toml");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(codexPath, 'approval_policy = "never"\n\n[other]\nx = 1\n');
    const config = buildCliToolConfig("codex", "http://127.0.0.1:20129", "nesa_local", "auto");
    config.files[0]!.path = codexPath;
    applyCliToolConfigLocal(config);
    const saved = fs.readFileSync(codexPath, "utf8");
    expect(saved).toContain('approval_policy = "never"');
    expect(saved).toContain("[other]");
    expect(saved).toContain('model_provider = "nesa"');
  });

  it("applies Claude override into an existing settings file", () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ permissions: { allow: ["Bash"] }, env: { OTHER: "keep" } }, null, 2)
    );

    const config = buildCliToolConfig("claude-code", "http://127.0.0.1:20129", "nesa_local", "auto");
    config.files[0]!.path = settingsPath;

    const result = applyCliToolConfigLocal(config);
    expect(result.skipped).toBe(false);

    const saved = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(saved.permissions).toEqual({ allow: ["Bash"] });
    expect(saved.env.OTHER).toBe("keep");
    expect(saved.env.ANTHROPIC_AUTH_TOKEN).toBe("nesa_local");
    expect(saved.env.ANTHROPIC_BASE_URL).toBe("http://127.0.0.1:20129/v1");
  });

  it("refuses to overwrite malformed JSON", () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(settingsPath, "{ broken", "utf8");
    expect(() => applyCliConfigFile({ path: settingsPath, content: '{"env":{"X":"1"}}', writeMode: "merge-json" })).toThrow(/existing JSON is invalid/i);
    expect(fs.readFileSync(settingsPath, "utf8")).toBe("{ broken");
  });

  it("merges Hermes and TOML targets without wiping unrelated config", () => {
    const yaml = mergeHermesModelYaml("ui:\n  theme: dark\nmodel:\n  temperature: 0.2\n  default: old\n", "model:\n  default: auto\n  provider: openai\n  base_url: http://127.0.0.1:20129/v1\n");
    expect(yaml).toContain("theme: dark");
    expect(yaml).toContain("temperature: 0.2");
    expect(yaml).not.toContain("default: old");
    const toml = mergeTomlConfig("[other]\nx=1\n\n[provider]\nbase_url='old'\n", "[provider]\nbase_url='new'\n", "provider");
    expect(toml).toContain("[other]");
    expect(toml).not.toContain("base_url='old'");
  });

  it("fully resets Qwen and OpenClaw Nesa references", () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ modelProviders: { openai: [{ id: "auto", baseUrl: "http://127.0.0.1:20129/v1", envKey: "NESA_ROUTER_API_KEY" }, { id: "other" }] }, env: { NESA_ROUTER_API_KEY: "x", KEEP: "y" }, model: { name: "auto" }, security: { auth: { selectedType: "openai" } } }));
    resetCliToolConfigLocal("qwen-code", { settingsPath });
    const qwen = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(qwen.modelProviders.openai).toEqual([{ id: "other" }]);
    expect(qwen.env).toEqual({ KEEP: "y" });
    expect(qwen.model).toBeUndefined();

    fs.writeFileSync(settingsPath, JSON.stringify({ models: { providers: { nesa: { apiKey: "x" }, other: {} } }, agents: { defaults: { model: { primary: "nesa/auto", fallback: "other/x" }, models: { "nesa/auto": {}, "other/x": {} } } } }));
    resetCliToolConfigLocal("openclaw", { settingsPath });
    const openclaw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(openclaw.models.providers.nesa).toBeUndefined();
    expect(openclaw.agents.defaults.model).toEqual({ fallback: "other/x" });
    expect(openclaw.agents.defaults.models).toEqual({ "other/x": {} });
  });

  it("resets Claude NesaRouter env keys while keeping other settings", async () => {
    const { resetCliToolConfigLocal } = await import("@/lib/cliLocalApply");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          permissions: { allow: ["Bash"] },
          env: { OTHER: "keep", ANTHROPIC_BASE_URL: "http://127.0.0.1:20129/v1", ANTHROPIC_AUTH_TOKEN: "x" }
        },
        null,
        2
      )
    );
    const result = resetCliToolConfigLocal("claude-code", { settingsPath });
    expect(result.ok).toBe(true);
    const saved = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(saved.permissions).toEqual({ allow: ["Bash"] });
    expect(saved.env.OTHER).toBe("keep");
    expect(saved.env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(saved.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
  });

  it("applies and detects Hermes / Codex local patches", async () => {
    const {
      applyCliToolConfigLocal: applyLocal,
      extractBaseUrlFromText,
      looksLikeNesa,
      readCliToolStatus,
      resetCliToolConfigLocal,
      stripTomlTable
    } = await import("@/lib/cliLocalApply");
    const { isCliToolFilePatchable } = await import("@/lib/cliToolConfig");

    expect(isCliToolFilePatchable("hermes")).toBe(true);
    expect(isCliToolFilePatchable("codex")).toBe(true);
    expect(isCliToolFilePatchable("deepseek-tui")).toBe(true);
    expect(isCliToolFilePatchable("jcode")).toBe(true);
    expect(isCliToolFilePatchable("cursor")).toBe(false);

    expect(extractBaseUrlFromText('base_url: "http://127.0.0.1:20129/v1"\n')).toBe("http://127.0.0.1:20129/v1");
    expect(looksLikeNesa("http://127.0.0.1:20129/v1")).toBe(true);

    const hermesDir = path.join(tmpDir, ".hermes");
    fs.mkdirSync(hermesDir, { recursive: true });
    const hermesYaml = path.join(hermesDir, "config.yaml");
    const hermesEnv = path.join(hermesDir, ".env");
    const hermesCfg = buildCliToolConfig("hermes", "http://127.0.0.1:20129", "nesa_h", "auto");
    hermesCfg.files = hermesCfg.files.map((file) => ({
      ...file,
      path: file.path.endsWith(".env") ? hermesEnv : hermesYaml
    }));
    expect(applyLocal(hermesCfg).skipped).toBe(false);
    expect(fs.readFileSync(hermesEnv, "utf8")).toContain("OPENAI_BASE_URL=http://127.0.0.1:20129/v1");

    // Simulate status reader against temp paths via extract helpers (home-based status uses ~/.hermes).
    expect(extractBaseUrlFromText(fs.readFileSync(hermesEnv, "utf8"))).toContain("20129");

    fs.writeFileSync(hermesEnv, "OPENAI_BASE_URL=http://127.0.0.1:20129/v1\nOTHER=1\n", "utf8");
    fs.writeFileSync(hermesYaml, 'model:\n  default: "auto"\n  base_url: "http://127.0.0.1:20129/v1"\n', "utf8");
    // reset uses real home paths — exercise strip helpers instead for temp files:
    const strippedEnv = fs
      .readFileSync(hermesEnv, "utf8")
      .split(/\r?\n/)
      .filter((line) => !/^\s*OPENAI_/.test(line))
      .join("\n");
    expect(strippedEnv).toContain("OTHER=1");
    expect(strippedEnv).not.toContain("OPENAI_BASE_URL");

    const codexRaw = `model = "auto"\n\n[model_providers.nesa]\nname = "NesaRouter"\nbase_url = "http://127.0.0.1:20129/v1"\n\n[other]\nx = 1\n`;
    const withoutNesa = stripTomlTable(codexRaw, "model_providers.nesa");
    expect(withoutNesa).not.toContain("model_providers.nesa");
    expect(withoutNesa).toContain("[other]");
    expect(readCliToolStatus("cursor").configStatus).toBe("unsupported");
    expect(resetCliToolConfigLocal("cursor").ok).toBe(false);
  });

  it("removes a TOML table without stopping at arrays inside the table", async () => {
    const { stripTomlTable } = await import("@/lib/cliLocalApply");
    const input = [
      "[model_providers.nesa]",
      'models = ["gpt-5", "claude"]',
      'headers = { feature = "[enabled]" }',
      'base_url = "http://localhost:20129/v1"',
      "",
      "[model_providers.other]",
      'name = "keep"'
    ].join("\n");
    const result = stripTomlTable(input, "model_providers.nesa");
    expect(result).not.toContain("base_url");
    expect(result).not.toContain("gpt-5");
    expect(result).toContain("[model_providers.other]");
    expect(result).toContain('name = "keep"');
  });
});
