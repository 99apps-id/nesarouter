import path from "node:path";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { getDataDir, getDb } from "@/lib/store";

const BACKUP_SUBDIR = "backups";
export const DEFAULT_BACKUP_KEEP = 7;
export const DEFAULT_BACKUP_INTERVAL_HOURS = 24;

export function backupsDir(dataDir = getDataDir()) {
  return path.join(dataDir, BACKUP_SUBDIR);
}

function timestampedBackupName(now = new Date()) {
  return `nesa-router-${now.toISOString().replace(/[:.]/g, "-")}.sqlite`;
}

/** Keep the newest `keep` backups, delete the rest. `keep <= 0` disables pruning. */
export function pruneOldBackups(dir: string, keep: number) {
  if (keep <= 0) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  const files = entries
    .filter((name) => name.endsWith(".sqlite"))
    .map((name) => {
      const full = path.join(dir, name);
      try {
        return { full, mtime: statSync(full).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is { full: string; mtime: number } => entry !== null)
    .sort((a, b) => b.mtime - a.mtime);
  for (const file of files.slice(keep)) {
    try { unlinkSync(file.full); } catch {}
  }
}

/**
 * Online backup via better-sqlite3's native backup API — safe to run while the
 * server is handling requests (WAL mode keeps writers unblocked during backup).
 */
export async function backupDatabaseNow(keep = DEFAULT_BACKUP_KEEP): Promise<string> {
  const dir = backupsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const dest = path.join(dir, timestampedBackupName());
  await getDb().backup(dest);
  pruneOldBackups(dir, keep);
  return dest;
}

/** `0` disables the schedule. Invalid values fall back to the default. */
export function readBackupIntervalHours(): number {
  const raw = process.env.NESA_DB_BACKUP_INTERVAL_HOURS?.trim();
  if (!raw) return DEFAULT_BACKUP_INTERVAL_HOURS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_BACKUP_INTERVAL_HOURS;
}

export function readBackupKeepCount(): number {
  const raw = process.env.NESA_DB_BACKUP_KEEP?.trim();
  if (!raw) return DEFAULT_BACKUP_KEEP;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_BACKUP_KEEP;
}

let scheduled = false;

/** Start the recurring backup timer once per process. No-op when the interval is 0 or already scheduled. */
export function startAutoBackupSchedule() {
  if (scheduled) return;
  scheduled = true;
  const hours = readBackupIntervalHours();
  if (hours <= 0) return;
  const keep = readBackupKeepCount();
  const run = () => {
    backupDatabaseNow(keep)
      .then((dest) => console.log("[debug-backup] ok", dest))
      .catch((error) => {
        console.error("[debug-backup] failed", error);
      });
  };
  run();
  const timer = setInterval(run, hours * 60 * 60_000);
  timer.unref?.();
}

/** Test helper — allow re-scheduling within the same process. */
export function resetAutoBackupScheduleForTests() {
  scheduled = false;
}
