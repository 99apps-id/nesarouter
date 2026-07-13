import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

/**
 * Next standalone layout varies by install directory name:
 * - .next/standalone/server.js
 * - .next/standalone/<dirname>/server.js  (e.g. nesarouter, app, NesaRouter)
 */
function resolveStandaloneServer(root) {
  const build = join(root, ".next");
  const standaloneRoot = join(build, "standalone");
  const direct = join(standaloneRoot, "server.js");
  if (existsSync(direct)) {
    return { server: direct, cwd: standaloneRoot, build, standaloneRoot };
  }

  if (!existsSync(standaloneRoot)) return null;

  for (const entry of readdirSync(standaloneRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nestedDir = join(standaloneRoot, entry.name);
    const nestedServer = join(nestedDir, "server.js");
    if (existsSync(nestedServer)) {
      return { server: nestedServer, cwd: nestedDir, build, standaloneRoot };
    }
  }

  return null;
}

const root = process.cwd();
const resolved = resolveStandaloneServer(root);

if (!resolved) {
  console.error("Production build not found. Run npm run build first.");
  console.error("Expected .next/standalone/server.js or .next/standalone/<app>/server.js");
  process.exit(1);
}

const { server, cwd, build } = resolved;

// Next standalone excludes browser assets by design. Copy them next to server.js
// so local and VPS runs serve the same CSS, scripts, and favicon files.
const staticSource = join(build, "static");
if (existsSync(staticSource)) {
  mkdirSync(join(cwd, ".next"), { recursive: true });
  cpSync(staticSource, join(cwd, ".next", "static"), { recursive: true, force: true });
}
const publicSource = join(root, "public");
if (existsSync(publicSource)) {
  cpSync(publicSource, join(cwd, "public"), { recursive: true, force: true });
}

const child = spawn(process.execPath, [server], {
  cwd,
  env: {
    ...process.env,
    PORT: process.env.PORT || "20129",
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0"
  },
  stdio: "inherit"
});
child.on("exit", (code) => process.exit(code ?? 0));
