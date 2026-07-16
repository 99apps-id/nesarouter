import os from "node:os";
import path from "node:path";

// Unit tests must never share the live ./data database with a running dev server
// or with another Vitest worker.
process.env.DATA_DIR = path.join(os.tmpdir(), `nesarouter-vitest-${process.pid}`);
