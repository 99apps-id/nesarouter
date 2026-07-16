import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const self = "scripts/check-public-boundary.mjs";
const listed = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8"
});

if (listed.status !== 0) {
  console.error("Could not enumerate repository files for the public-boundary check.");
  process.exit(1);
}

const forbiddenPaths = [/(^|\/)src\/core\/saas(\/|$)/i, /(^|\/)tests\/.*saas/i, /saasAdmission/i];
const forbiddenMarkers = ["NESA_" + "SAAS_", "@/core/" + "saas/", "admission_token_" + "reservations"];
const violations = [];

for (const relative of listed.stdout.split(/\r?\n/).filter(Boolean)) {
  const normalized = relative.replaceAll("\\", "/");
  if (normalized === self) continue;
  if (forbiddenPaths.some((pattern) => pattern.test(normalized))) {
    violations.push(`${normalized}: private SaaS path`);
    continue;
  }
  const absolute = path.join(root, relative);
  let stat;
  try { stat = fs.statSync(absolute); } catch { continue; }
  if (!stat.isFile() || stat.size > 2_000_000) continue;
  const content = fs.readFileSync(absolute, "utf8");
  for (const marker of forbiddenMarkers) {
    if (content.includes(marker)) violations.push(`${normalized}: contains private marker ${marker}`);
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.dependencies?.pg || pkg.devDependencies?.["@types/pg"]) {
  violations.push("package.json: PostgreSQL dependency belongs to the private SaaS repository");
}

if (violations.length) {
  console.error("Public repository boundary violated:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Public repository boundary OK (no private SaaS implementation detected).");
