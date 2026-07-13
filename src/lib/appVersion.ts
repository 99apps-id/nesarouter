import { readFileSync } from "node:fs";
import path from "node:path";
import packageJson from "../../package.json";

const BUNDLED_VERSION =
  typeof packageJson?.version === "string" && packageJson.version.trim() ? packageJson.version.trim() : undefined;

function versionFromPackageFile(filePath: string) {
  try {
    const pkg = JSON.parse(readFileSync(filePath, "utf8")) as { name?: string; version?: string };
    if (!pkg.version?.trim()) return undefined;
    if (!pkg.name || pkg.name === "nesa-router" || pkg.name === "nesarouter") return pkg.version.trim();
    return undefined;
  } catch {
    return undefined;
  }
}

function searchRoots() {
  const roots = new Set<string>();
  const add = (start?: string) => {
    if (!start) return;
    let dir = path.resolve(start);
    for (let depth = 0; depth < 6; depth += 1) {
      roots.add(dir);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  };

  add(process.cwd());
  if (process.argv[1]) {
    add(path.dirname(path.resolve(process.cwd(), process.argv[1])));
    add(path.dirname(path.resolve(process.argv[1])));
  }

  return [...roots];
}

function versionFromFilesystem() {
  const candidates = new Set<string>();
  for (const root of searchRoots()) {
    candidates.add(path.join(root, "package.json"));
  }

  for (const candidate of candidates) {
    const version = versionFromPackageFile(candidate);
    if (version) return version;
  }

  return undefined;
}

/** App semver for sidebar, update checks, and release banners. */
export function readAppVersion() {
  const fromEnv = process.env.NESA_APP_VERSION?.trim() || process.env.npm_package_version?.trim();
  if (fromEnv) return fromEnv;
  if (BUNDLED_VERSION) return BUNDLED_VERSION;
  return versionFromFilesystem() ?? "0.0.0";
}
