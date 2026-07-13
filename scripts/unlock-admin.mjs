import Database from "better-sqlite3";
import { join } from "node:path";

const dataDir = process.env.DATA_DIR || "data";
const db = new Database(join(dataDir, "nesa-router.sqlite"));
db.prepare("DELETE FROM settings WHERE key = 'loginLock'").run();
db.close();

console.log(`Login lock cleared for ${dataDir}. Password and sessions were not changed.`);
