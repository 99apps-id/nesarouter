import { readFileSync } from "node:fs";
import path from "node:path";

export interface UpdateCheckResult {
  enabled: boolean;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseName: string | null;
  checkedAt: string;
  error?: string;
}

const DEFAULT_REPO = "99apps-id/nesarouter";
const CACHE_MS = 6 * 60 * 60 * 1000;

let cache: { expiresAt: number; result: UpdateCheckResult } | null = null;

function githubRepo() {
  return (process.env.NESA_GITHUB_REPO?.trim() || DEFAULT_REPO).replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
}

export function readPackageVersion() {
  const candidates = [
    path.join(process.cwd(), "package.json"),
    path.join(process.cwd(), "..", "package.json"),
    path.join(process.cwd(), "..", "..", "package.json")
  ];
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as { name?: string; version?: string };
      if (pkg.name === "nesa-router" && pkg.version) return pkg.version;
      if (pkg.version && !pkg.name) return pkg.version;
    } catch {
      /* try next */
    }
  }
  return process.env.npm_package_version ?? "0.0.0";
}

/** Compare dotted semver-ish tags. Returns 1 if a>b, -1 if a<b, 0 if equal/unknown. */
export function compareVersions(a: string, b: string) {
  const normalize = (value: string) =>
    value
      .trim()
      .replace(/^v/i, "")
      .split(/[+-]/)[0]
      .split(".")
      .map((part) => Number.parseInt(part.replace(/[^\d].*$/, ""), 10) || 0);

  const left = normalize(a);
  const right = normalize(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

export async function checkForAppUpdate(options?: { force?: boolean }): Promise<UpdateCheckResult> {
  const currentVersion = readPackageVersion();
  const checkedAt = new Date().toISOString();
  const disabled =
    process.env.NESA_UPDATE_CHECK === "0" ||
    process.env.NESA_UPDATE_CHECK === "false" ||
    process.env.NESA_UPDATE_CHECK === "off";

  if (disabled) {
    return {
      enabled: false,
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: null,
      releaseName: null,
      checkedAt
    };
  }

  if (!options?.force && cache && cache.expiresAt > Date.now()) {
    return cache.result;
  }

  const repo = githubRepo();
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": `NesaRouter/${currentVersion}`
      },
      signal: AbortSignal.timeout(8_000)
    });

    if (response.status === 404) {
      const result: UpdateCheckResult = {
        enabled: true,
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        releaseUrl: `https://github.com/${repo}/releases`,
        releaseName: null,
        checkedAt,
        error: "No GitHub releases found yet."
      };
      cache = { expiresAt: Date.now() + CACHE_MS, result };
      return result;
    }

    if (!response.ok) {
      throw new Error(`GitHub releases API returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      tag_name?: string;
      name?: string;
      html_url?: string;
      draft?: boolean;
      prerelease?: boolean;
    };

    if (payload.draft || payload.prerelease) {
      const result: UpdateCheckResult = {
        enabled: true,
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        releaseUrl: payload.html_url ?? `https://github.com/${repo}/releases`,
        releaseName: null,
        checkedAt
      };
      cache = { expiresAt: Date.now() + CACHE_MS, result };
      return result;
    }

    const latestVersion = (payload.tag_name ?? "").replace(/^v/i, "");
    const updateAvailable = Boolean(latestVersion) && compareVersions(latestVersion, currentVersion) > 0;
    const result: UpdateCheckResult = {
      enabled: true,
      currentVersion,
      latestVersion: latestVersion || null,
      updateAvailable,
      releaseUrl: payload.html_url ?? `https://github.com/${repo}/releases`,
      releaseName: payload.name ?? payload.tag_name ?? null,
      checkedAt
    };
    cache = { expiresAt: Date.now() + CACHE_MS, result };
    return result;
  } catch (error) {
    const result: UpdateCheckResult = {
      enabled: true,
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: `https://github.com/${repo}/releases`,
      releaseName: null,
      checkedAt,
      error: error instanceof Error ? error.message : "Update check failed."
    };
    // Shorter cache on errors so a later attempt can succeed.
    cache = { expiresAt: Date.now() + 30 * 60_000, result };
    return result;
  }
}
