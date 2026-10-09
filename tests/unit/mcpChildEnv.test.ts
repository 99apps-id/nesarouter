import { afterEach, describe, expect, it } from "vitest";
import { MCP_CHILD_BLOCKED_ENV, mcpChildEnv } from "@/core/mcpBridge";

describe("mcp child environment", () => {
  const saved = new Map<string, string | undefined>();
  for (const key of MCP_CHILD_BLOCKED_ENV) saved.set(key, process.env[key]);

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("never hands router secrets to the spawned MCP server", () => {
    process.env.NESA_ENCRYPTION_KEY = "super-secret-db-key";
    process.env.NESA_ADMIN_SESSION_SECRET = "session-hmac";
    process.env.NESA_ADMIN_PASSWORD = "bootstrap-password";
    process.env.NESA_METRICS_TOKEN = "metrics-token";

    const env = mcpChildEnv({ env: {} });
    for (const key of MCP_CHILD_BLOCKED_ENV) expect(env[key]).toBeUndefined();
  });

  it("keeps the rest of the environment so MCP servers still run", () => {
    process.env.NESA_ENCRYPTION_KEY = "super-secret-db-key";
    const env = mcpChildEnv({ env: { MCP_TOKEN: "ctx-token" } });
    expect(env.MCP_TOKEN).toBe("ctx-token");
    expect(env.NESA_ENCRYPTION_KEY).toBeUndefined();
    // PATH (or Path on Windows) must survive for npx/uvx style launchers.
    expect(env.PATH ?? env.Path).toBeTruthy();
  });

  it("lets an explicitly configured env var win over the blocklist", () => {
    process.env.NESA_ENCRYPTION_KEY = "super-secret-db-key";
    const env = mcpChildEnv({ env: { NESA_ENCRYPTION_KEY: "explicit-opt-in" } });
    expect(env.NESA_ENCRYPTION_KEY).toBe("explicit-opt-in");
  });
});
