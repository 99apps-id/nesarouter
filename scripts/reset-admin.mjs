import Database from "better-sqlite3";
import { join } from "node:path";

const dataDir = process.env.DATA_DIR || "data";
const db = new Database(join(dataDir, "nesa-router.sqlite"));
db.prepare("DELETE FROM settings WHERE key = 'adminPasswordHash'").run();
db.prepare("DELETE FROM settings WHERE key = 'loginLock' OR key LIKE 'loginLock:%'").run();
try {
  db.prepare("DELETE FROM admin_sessions").run();
} catch {
  /* table may not exist on very old DBs */
}
db.close();
console.log(`Admin password + sessions reset for ${dataDir}; the configured bootstrap password is active.`);
