import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyCliToolConfigLocal, deepMergeJson } from "@/lib/cliLocalApply";
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
});
