import { describe, expect, it } from "vitest";
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

  it("builds install scripts that write config files", () => {
    const config = buildCliToolConfig("claude-code", "http://localhost:20129", "nesa_test", "auto");
    const scripts = buildCliInstallScripts(config);
    expect(scripts.bash).toContain("$HOME/.claude/settings.json");
    expect(scripts.powershell).toContain("USERPROFILE");
    expect(scripts.bash).toContain("nesa_test");
  });
});
