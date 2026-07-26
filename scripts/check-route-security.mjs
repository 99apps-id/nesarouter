import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();

function routeFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(path));
    else if (entry.name === "route.ts") files.push(path);
  }
  return files;
}

function routePath(file) {
  return relative(root, file).split(sep).join("/");
}

const publicApiPolicies = new Map([
  ["src/app/api/auth/login/route.ts", "verifyAdminPassword"],
  ["src/app/api/auth/logout/route.ts", "revokeAdminToken"],
  ["src/app/api/auth/oauth/[provider]/callback/route.ts", "timingSafeEqualString"],
  ["src/app/api/auth/oauth/[provider]/start/route.ts", "oauthStateCookieName"],
  ["src/app/api/auth/session/route.ts", "resolveVerifiedAdminSessionToken"],
  ["src/app/api/health/route.ts", "readStore"],
  ["src/app/api/metrics/route.ts", "authorizeMetrics"],
  ["src/app/api/providers/oauth/callback/route.ts", "readOAuthPending"],
  ["src/app/api/tags/route.ts", "authorizeRequest"]
]);

const violations = [];
const apiRoutes = routeFiles(join(root, "src", "app", "api"));
for (const file of apiRoutes) {
  const path = routePath(file);
  const source = readFileSync(file, "utf8");
  const publicPolicy = publicApiPolicies.get(path);
  if (publicPolicy) {
    if (!source.includes(publicPolicy)) {
      violations.push(`${path}: public route is missing its expected ${publicPolicy} policy`);
    }
  } else if (!source.includes("requireAdmin")) {
    violations.push(`${path}: admin route is missing requireAdmin`);
  }

  if (source.includes("request.json(")) {
    violations.push(`${path}: bypasses the bounded JSON reader`);
  }
}

for (const expected of publicApiPolicies.keys()) {
  if (!apiRoutes.some((file) => routePath(file) === expected)) {
    violations.push(`${expected}: classified public route no longer exists; update the policy map`);
  }
}

const v1Routes = routeFiles(join(root, "src", "app", "v1"));
for (const file of v1Routes) {
  const path = routePath(file);
  const source = readFileSync(file, "utf8");
  if (!source.includes("authorizeClientRequest") && !source.includes("authorizeRequest")) {
    violations.push(`${path}: client route is missing bearer-key authorization`);
  }
}

if (violations.length) {
  console.error(`Route security check failed:\n${violations.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log(
  `Route security OK (${apiRoutes.length} admin/public routes, ${v1Routes.length} authenticated client routes).`
);
