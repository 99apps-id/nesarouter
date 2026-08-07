import { describe, expect, it } from "vitest";
import {
  buildMcpPresetPayload,
  MCP_PRESETS,
  missingMcpPresetFields
} from "@/lib/mcpPresets";
import { McpServerSchema } from "@/lib/validation";

describe("MCP preset catalog", () => {
  it("has unique ids and valid basic fields", () => {
    const ids = MCP_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of MCP_PRESETS) {
      expect(preset.name.trim().length).toBeGreaterThan(0);
      expect(preset.description.trim().length).toBeGreaterThan(0);
      expect(preset.command.trim()).toBe("npx");
      expect(preset.args.length).toBeGreaterThanOrEqual(2);
      expect(preset.args[0]).toBe("-y");
      // id is a safe slug
      expect(preset.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("every preset payload passes the MCP server schema", () => {
    for (const preset of MCP_PRESETS) {
      const payload = buildMcpPresetPayload(preset, {});
      const parsed = McpServerSchema.safeParse(payload);
      expect(parsed.success, `${preset.id}: ${parsed.success ? "" : parsed.error?.message}`).toBe(true);
    }
  });

  it("substitutes arg fields (filesystem dir, sqlite db path)", () => {
    const filesystem = MCP_PRESETS.find((preset) => preset.id === "filesystem")!;
    const payload = buildMcpPresetPayload(filesystem, { "2": "/srv/data" });
    expect(payload.args).toEqual(["-y", "@modelcontextprotocol/server-filesystem", "/srv/data"]);

    const sqlite = MCP_PRESETS.find((preset) => preset.id === "sqlite")!;
    const defaultPayload = buildMcpPresetPayload(sqlite, {});
    expect(defaultPayload.args).toEqual(["-y", "mcp-server-sqlite", "--db-path", "/tmp/nesa.db"]);
  });

  it("uses defaults when the operator leaves an arg empty", () => {
    const filesystem = MCP_PRESETS.find((preset) => preset.id === "filesystem")!;
    const payload = buildMcpPresetPayload(filesystem, { "2": "   " });
    expect(payload.args[2]).toBe("/tmp");
  });

  it("sets env keys from fields and keeps secrets out of the payload when blank", () => {
    const github = MCP_PRESETS.find((preset) => preset.id === "github")!;
    const payload = buildMcpPresetPayload(github, { GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_x" });
    expect(payload.env).toEqual({ GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_x" });

    const brave = MCP_PRESETS.find((preset) => preset.id === "brave-search")!;
    const blank = buildMcpPresetPayload(brave, { BRAVE_API_KEY: "" });
    expect(blank.env).toEqual({});
  });

  it("flags required fields (github token required, context7 optional)", () => {
    const github = MCP_PRESETS.find((preset) => preset.id === "github")!;
    expect(missingMcpPresetFields(github, {}).map((field) => field.target)).toEqual([
      "GITHUB_PERSONAL_ACCESS_TOKEN"
    ]);
    expect(missingMcpPresetFields(github, { GITHUB_PERSONAL_ACCESS_TOKEN: "x" })).toHaveLength(0);

    const context7 = MCP_PRESETS.find((preset) => preset.id === "context7")!;
    expect(missingMcpPresetFields(context7, {})).toHaveLength(0);
  });

  it("arg field targets reference existing arg indexes", () => {
    for (const preset of MCP_PRESETS) {
      for (const field of preset.fields) {
        if (field.kind !== "arg") continue;
        const index = Number(field.target);
        expect(Number.isInteger(index), `${preset.id} arg target ${field.target}`).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(preset.args.length);
      }
    }
  });
});
