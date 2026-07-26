import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error The production launcher is an ESM JavaScript entrypoint.
import { productionEnvironmentErrors, readRuntimeDistDir, resolveStandaloneDataDir, resolveStandaloneServer } from "../../scripts/start-standalone.mjs";

const root = path.join(os.tmpdir(), `nesarouter-standalone-${process.pid}`);

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function server(dist: string, source = '{"distDir":"./.next"}') {
  const file = path.join(root, dist, "standalone", "server.js");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
  return file;
}

describe("standalone startup paths", () => {
  it("selects the newest complete build when .next and .next-new coexist", async () => {
    const old = server(".next");
    const fresh = server(".next-new", '{"distDir":"./.next-new"}');
    const past = new Date(Date.now() - 10_000);
    fs.utimesSync(old, past, past);
    await expect(resolveStandaloneServer(root)?.server).toBe(fresh);
  });

  it("accepts safe Next dist directories and rejects escaped paths", () => {
    const safe = server(".next", '{"distDir":"./.next-new"}');
    expect(readRuntimeDistDir(safe)).toBe(".next-new");
    fs.writeFileSync(safe, '{"distDir":"../../tmp"}');
    expect(readRuntimeDistDir(safe)).toBe(".next");
  });

  it("anchors default and relative DATA_DIR values at the project root", () => {
    expect(resolveStandaloneDataDir(root, undefined)).toBe(path.resolve(root, "data"));
    expect(resolveStandaloneDataDir(root, "data-custom")).toBe(path.resolve(root, "data-custom"));
    expect(resolveStandaloneDataDir(root, path.resolve(root, "absolute"))).toBe(path.resolve(root, "absolute"));
  });

  it("rejects missing and placeholder production credentials before startup", () => {
    expect(productionEnvironmentErrors({ NODE_ENV: "production" })).toHaveLength(2);
    expect(productionEnvironmentErrors({
      NODE_ENV: "production",
      NESA_ENCRYPTION_KEY: "replace-with-long-random-secret",
      NESA_ADMIN_PASSWORD: "change-me"
    })).toHaveLength(2);
  });

  it("accepts strong production credentials without exposing their values", () => {
    expect(productionEnvironmentErrors({
      NODE_ENV: "production",
      NESA_ENCRYPTION_KEY: "a".repeat(32),
      NESA_ADMIN_PASSWORD: "operator-password"
    })).toEqual([]);
  });

  it("does not require production credentials during local development", () => {
    expect(productionEnvironmentErrors({ NODE_ENV: "development" })).toEqual([]);
  });
});
