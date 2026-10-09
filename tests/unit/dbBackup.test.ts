import { existsSync, mkdirSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  backupDatabaseNow,
  backupsDir,
  DEFAULT_FIRST_BACKUP_DELAY_MS,
  pruneOldBackups,
  readBackupIntervalHours,
  readBackupKeepCount,
  readFirstBackupDelayMs
} from "@/lib/dbBackup";
import { getDataDir } from "@/lib/store";

describe("readBackupIntervalHours / readBackupKeepCount", () => {
  const prevInterval = process.env.NESA_DB_BACKUP_INTERVAL_HOURS;
  const prevKeep = process.env.NESA_DB_BACKUP_KEEP;

  afterEach(() => {
    if (prevInterval === undefined) delete process.env.NESA_DB_BACKUP_INTERVAL_HOURS;
    else process.env.NESA_DB_BACKUP_INTERVAL_HOURS = prevInterval;
    if (prevKeep === undefined) delete process.env.NESA_DB_BACKUP_KEEP;
    else process.env.NESA_DB_BACKUP_KEEP = prevKeep;
  });

  it("defaults to 24h / keep 7 when unset", () => {
    delete process.env.NESA_DB_BACKUP_INTERVAL_HOURS;
    delete process.env.NESA_DB_BACKUP_KEEP;
    expect(readBackupIntervalHours()).toBe(24);
    expect(readBackupKeepCount()).toBe(7);
  });

  it("honors 0 as an explicit disable value", () => {
    process.env.NESA_DB_BACKUP_INTERVAL_HOURS = "0";
    expect(readBackupIntervalHours()).toBe(0);
  });

  it("falls back to the default on invalid input", () => {
    process.env.NESA_DB_BACKUP_INTERVAL_HOURS = "not-a-number";
    expect(readBackupIntervalHours()).toBe(24);
  });
});

describe("readFirstBackupDelayMs", () => {
  const prev = process.env.NESA_DB_BACKUP_FIRST_DELAY_MS;
  afterEach(() => {
    if (prev === undefined) delete process.env.NESA_DB_BACKUP_FIRST_DELAY_MS;
    else process.env.NESA_DB_BACKUP_FIRST_DELAY_MS = prev;
  });

  it("defaults to a non-zero delay so the first backup cannot stall boot", () => {
    delete process.env.NESA_DB_BACKUP_FIRST_DELAY_MS;
    expect(readFirstBackupDelayMs()).toBe(DEFAULT_FIRST_BACKUP_DELAY_MS);
    expect(readFirstBackupDelayMs()).toBeGreaterThan(0);
  });

  it("honors an explicit delay, including 0 to restore immediate backup", () => {
    process.env.NESA_DB_BACKUP_FIRST_DELAY_MS = "0";
    expect(readFirstBackupDelayMs()).toBe(0);
    process.env.NESA_DB_BACKUP_FIRST_DELAY_MS = "1500";
    expect(readFirstBackupDelayMs()).toBe(1500);
  });

  it("falls back to the default on invalid input", () => {
    process.env.NESA_DB_BACKUP_FIRST_DELAY_MS = "soon";
    expect(readFirstBackupDelayMs()).toBe(DEFAULT_FIRST_BACKUP_DELAY_MS);
  });
});

describe("pruneOldBackups", () => {
  it("keeps only the newest N .sqlite files", () => {
    const dir = backupsDir(getDataDir());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const names = ["a.sqlite", "b.sqlite", "c.sqlite", "d.sqlite"];
    names.forEach((name, index) => {
      const full = path.join(dir, name);
      writeFileSync(full, "x");
      const time = new Date(Date.now() - (names.length - index) * 60_000);
      utimesSync(full, time, time);
    });
    pruneOldBackups(dir, 2);
    const remaining = readdirSync(dir).filter((name) => name.endsWith(".sqlite"));
    expect(remaining.sort()).toEqual(["c.sqlite", "d.sqlite"]);
  });

  it("does nothing when keep <= 0", () => {
    const dir = backupsDir(getDataDir());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "keep-me.sqlite"), "x");
    pruneOldBackups(dir, 0);
    expect(readdirSync(dir)).toContain("keep-me.sqlite");
  });
});

describe("backupDatabaseNow", () => {
  it("writes a timestamped .sqlite file into data/backups", async () => {
    const dest = await backupDatabaseNow(7);
    expect(existsSync(dest)).toBe(true);
    expect(path.dirname(dest)).toBe(backupsDir(getDataDir()));
    expect(path.basename(dest)).toMatch(/^nesa-router-.*\.sqlite$/);
  });
});
