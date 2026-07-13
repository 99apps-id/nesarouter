import { cpSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const build = join(root, ".next");
const standalone = join(build, "standalone");
const server = join(standalone, "server.js");

if (!existsSync(server)) {
  console.error("Production build not found. Run npm run build first.");
  process.exit(1);
}

// Next standalone excludes browser assets by design. Copy them at startup so
// local and VPS runs serve the same CSS, scripts, and favicon files.
const staticSource = join(build, "static");
if (existsSync(staticSource)) {
  mkdirSync(join(standalone, ".next"), { recursive: true });
  cpSync(staticSource, join(standalone, ".next", "static"), { recursive: true, force: true });
}
const publicSource = join(root, "public");
if (existsSync(publicSource)) {
  cpSync(publicSource, join(standalone, "public"), { recursive: true, force: true });
}

const child = spawn(process.execPath, [server], {
  cwd: standalone,
  env: {
    ...process.env,
    PORT: process.env.PORT || "20129",
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0"
  },
  stdio: "inherit"
});
child.on("exit", (code) => process.exit(code ?? 0));
