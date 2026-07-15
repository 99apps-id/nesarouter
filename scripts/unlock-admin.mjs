import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = process.env.INIT_CWD || process.cwd();
const dataDirEnv = process.env.DATA_DIR?.trim();
const dataDir = resolve(projectRoot, dataDirEnv || "data");
const dbPath = join(dataDir, "nesa-router.sqlite");

if (!existsSync(dbPath)) {
  console.error(`No database found at ${dbPath}`);
  if (dataDirEnv) {
    console.error(`DATA_DIR is set to "${dataDirEnv}". Unset it to use ./data, or point it at the folder that has your real nesa-router.sqlite.`);
  } else {
    console.error("Start the app once to create the database, then retry.");
  }
  process.exit(1);
}

const db = new Database(dbPath);
db.prepare("DELETE FROM settings WHERE key = 'loginLock' OR key LIKE 'loginLock:%'").run();
db.close();

console.log(`Login lock cleared for ${dataDir}. Password and sessions were not changed.`);
if (dataDirEnv) {
  console.log(`Note: DATA_DIR=${dataDirEnv} (not the default ./data).`);
}
