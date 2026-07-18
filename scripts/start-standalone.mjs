import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Next standalone layout varies by install directory name:
 * - .next/standalone/server.js
 * - .next/standalone/<dirname>/server.js  (e.g. nesarouter, app, NesaRouter)
 * Atomic deploys may also use distDir=.next-new → .next-new/standalone/…
 */
export function resolveStandaloneServer(root) {
  const candidates = [];
  for (const distName of [".next", ".next-new"]) {
    const build = join(root, distName);
    const standaloneRoot = join(build, "standalone");
    const direct = join(standaloneRoot, "server.js");
    if (existsSync(direct)) {
      candidates.push({ server: direct, cwd: standaloneRoot, build, standaloneRoot, distName });
      continue;
    }

    if (!existsSync(standaloneRoot)) continue;

    for (const entry of readdirSync(standaloneRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const nestedDir = join(standaloneRoot, entry.name);
      const nestedServer = join(nestedDir, "server.js");
      if (existsSync(nestedServer)) {
        candidates.push({ server: nestedServer, cwd: nestedDir, build, standaloneRoot, distName });
        break;
      }
    }
  }

  return candidates.sort((a, b) => statSync(b.server).mtimeMs - statSync(a.server).mtimeMs)[0] ?? null;
}

function readAppVersion(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    if (typeof pkg.version === "string" && pkg.version.trim()) return pkg.version.trim();
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Runtime distDir embedded in standalone server.js (e.g. "./.next-new"). */
export function readRuntimeDistDir(serverPath, fallback = ".next") {
  try {
    const src = readFileSync(serverPath, "utf8");
    const match = src.match(/"distDir"\s*:\s*"([^"]+)"/);
    if (!match) return fallback;
    const raw = match[1].replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
    return /^\.next(?:-[A-Za-z0-9_-]+)?$/.test(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

export function resolveStandaloneDataDir(root, dataDir) {
  const raw = dataDir?.trim();
  return raw ? (isAbsolute(raw) ? raw : resolve(root, raw)) : resolve(root, "data");
}

function main() {
const root = process.cwd();
const resolved = resolveStandaloneServer(root);

if (!resolved) {
  console.error("Production build not found. Run npm run build first.");
  console.error("Expected .next/standalone/server.js or .next/standalone/<app>/server.js");
  process.exit(1);
}

const { server, cwd, build } = resolved;
const appVersion = process.env.NESA_APP_VERSION || readAppVersion(root);
const runtimeDistDir = readRuntimeDistDir(server, ".next");

// Next standalone excludes browser assets by design. With newer Next releases
// the middleware manifests also remain in .next/server, so copy both build
// surfaces before launching. Without the server directory every route starts
// but responds 500 when middleware is loaded.
//
// Important: server.js embeds distDir (sometimes "./.next-new" for atomic
// builds). Assets must land under cwd/<that-distDir>/, not always ".next".
const runtimeNextDir = join(cwd, runtimeDistDir);
const serverSource = join(build, "server");
if (existsSync(serverSource)) {
  mkdirSync(runtimeNextDir, { recursive: true });
  cpSync(serverSource, join(runtimeNextDir, "server"), { recursive: true, force: true });
}

// Copy browser assets next to server.js so local and VPS runs serve the same
// CSS, scripts, and favicon files.
const staticSource = join(build, "static");
if (existsSync(staticSource)) {
  mkdirSync(runtimeNextDir, { recursive: true });
  cpSync(staticSource, join(runtimeNextDir, "static"), { recursive: true, force: true });
}
const publicSource = join(root, "public");
if (existsSync(publicSource)) {
  cpSync(publicSource, join(cwd, "public"), { recursive: true, force: true });
}

// Ensure package.json is visible next to the standalone server for version reads.
const rootPackage = join(root, "package.json");
const cwdPackage = join(cwd, "package.json");
if (existsSync(rootPackage) && !existsSync(cwdPackage)) {
  try {
    cpSync(rootPackage, cwdPackage);
  } catch {
    /* ignore */
  }
}

// Standalone server.js runs with cwd under .next/standalone/… — relative DATA_DIR
// would open a different SQLite than the project ./data (lost password hash / keys).
const resolvedDataDir = resolveStandaloneDataDir(root, process.env.DATA_DIR);

const child = spawn(process.execPath, [server], {
  cwd,
  env: {
    ...process.env,
    PORT: process.env.PORT || "20129",
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
    INIT_CWD: root,
    DATA_DIR: resolvedDataDir,
    ...(appVersion ? { NESA_APP_VERSION: appVersion } : {})
  },
  stdio: "inherit"
});
child.on("exit", (code) => process.exit(code ?? 0));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
