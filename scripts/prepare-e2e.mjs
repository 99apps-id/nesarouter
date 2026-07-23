import { rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const target = path.resolve(root, ".tmp", "e2e-data");
const allowedRoot = `${path.resolve(root, ".tmp")}${path.sep}`;

if (!target.startsWith(allowedRoot)) {
  throw new Error(`Refusing to clean E2E data outside .tmp: ${target}`);
}

rmSync(target, { recursive: true, force: true });
