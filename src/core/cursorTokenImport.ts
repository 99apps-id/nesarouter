import Database from "better-sqlite3";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ACCESS_TOKEN_KEYS = ["cursorAuth/accessToken", "cursorAuth/token"];
const REFRESH_TOKEN_KEYS = ["cursorAuth/refreshToken"];
const MACHINE_ID_KEYS = ["storage.serviceMachineId", "storage.machineId", "telemetry.machineId"];

export type CursorImportedTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  machineId: string | null;
};

export function cursorDbCandidatePaths(platform: NodeJS.Platform = process.platform) {
  const home = homedir();
  if (platform === "darwin") {
    return [
      join(home, "Library/Application Support/Cursor/User/globalStorage/state.vscdb"),
      join(home, "Library/Application Support/Cursor - Insiders/User/globalStorage/state.vscdb")
    ];
  }
  if (platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    return [
      join(appData, "Cursor", "User", "globalStorage", "state.vscdb"),
      join(appData, "Cursor - Insiders", "User", "globalStorage", "state.vscdb"),
      join(localAppData, "Cursor", "User", "globalStorage", "state.vscdb"),
      join(localAppData, "Programs", "Cursor", "User", "globalStorage", "state.vscdb")
    ];
  }
  return [
    join(home, ".config/Cursor/User/globalStorage/state.vscdb"),
    join(home, ".config/cursor/User/globalStorage/state.vscdb")
  ];
}

export function normalizeCursorDbValue(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
}

/** Decode JWT `exp` without verifying signature — Cursor access tokens are JWTs. */
export function cursorAccessTokenExpiresAt(accessToken: string): string | undefined {
  const parts = accessToken.split(".");
  if (parts.length < 2) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { exp?: number };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return undefined;
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return undefined;
  }
}

function isSqliteLockError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /locked|busy|cantopen/i.test(message);
}

function withTempDbCopy<T>(dbPath: string, run: (path: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "nesa-cursor-"));
  const copyPath = join(dir, "state.vscdb");
  try {
    copyFileSync(dbPath, copyPath);
    return run(copyPath);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function extractViaBetterSqlite(dbPath: string): CursorImportedTokens {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const query = (key: string) => {
      const row = db.prepare("SELECT value FROM itemTable WHERE key=? LIMIT 1").get(key) as { value?: string } | undefined;
      return row?.value || null;
    };

    let accessToken: string | null = null;
    for (const key of ACCESS_TOKEN_KEYS) {
      const raw = query(key);
      if (raw) {
        accessToken = String(normalizeCursorDbValue(raw));
        break;
      }
    }

    let refreshToken: string | null = null;
    for (const key of REFRESH_TOKEN_KEYS) {
      const raw = query(key);
      if (raw) {
        refreshToken = String(normalizeCursorDbValue(raw));
        break;
      }
    }

    let machineId: string | null = null;
    for (const key of MACHINE_ID_KEYS) {
      const raw = query(key);
      if (raw) {
        machineId = String(normalizeCursorDbValue(raw));
        break;
      }
    }

    if (!accessToken || !machineId || !refreshToken) {
      const fuzzy = db
        .prepare(
          "SELECT key, value FROM itemTable WHERE key LIKE 'cursorAuth/%' OR key LIKE '%machineId%' OR key LIKE '%MachineId%' LIMIT 30"
        )
        .all() as Array<{ key: string; value?: string }>;
      for (const row of fuzzy) {
        const value = row.value ? String(normalizeCursorDbValue(row.value)) : "";
        if (!value) continue;
        if (!accessToken && /cursorAuth/i.test(row.key) && /access/i.test(row.key) && value.length >= 50) {
          accessToken = value;
        }
        if (!refreshToken && /cursorAuth/i.test(row.key) && /refresh/i.test(row.key) && value.length >= 20) {
          refreshToken = value;
        }
        if (!machineId && /machine/i.test(row.key) && value.length >= 8 && value.length <= 80) {
          machineId = value;
        }
      }
    }

    return { accessToken, refreshToken, machineId };
  } finally {
    db.close();
  }
}

async function extractViaCli(dbPath: string): Promise<CursorImportedTokens> {
  const query = async (sql: string) => {
    const { stdout } = await execFileAsync("sqlite3", [dbPath, sql], { timeout: 10_000 });
    return stdout.trim();
  };
  let accessToken: string | null = null;
  for (const key of ACCESS_TOKEN_KEYS) {
    try {
      const raw = await query(`SELECT value FROM itemTable WHERE key='${key}' LIMIT 1`);
      if (raw) {
        accessToken = String(normalizeCursorDbValue(raw));
        break;
      }
    } catch {
      /* next */
    }
  }
  let refreshToken: string | null = null;
  for (const key of REFRESH_TOKEN_KEYS) {
    try {
      const raw = await query(`SELECT value FROM itemTable WHERE key='${key}' LIMIT 1`);
      if (raw) {
        refreshToken = String(normalizeCursorDbValue(raw));
        break;
      }
    } catch {
      /* next */
    }
  }
  let machineId: string | null = null;
  for (const key of MACHINE_ID_KEYS) {
    try {
      const raw = await query(`SELECT value FROM itemTable WHERE key='${key}' LIMIT 1`);
      if (raw) {
        machineId = String(normalizeCursorDbValue(raw));
        break;
      }
    } catch {
      /* next */
    }
  }
  return { accessToken, refreshToken, machineId };
}

export async function findReadableCursorDbPath(platform: NodeJS.Platform = process.platform) {
  const candidates = cursorDbCandidatePaths(platform);
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.R_OK);
      return { dbPath: candidate, candidates };
    } catch {
      /* next */
    }
  }
  return { dbPath: null as string | null, candidates };
}

export async function readCursorTokensFromDb(dbPath: string) {
  const errors: string[] = [];

  const trySqlite = (path: string) => {
    try {
      return extractViaBetterSqlite(path);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return null;
    }
  };

  let tokens = trySqlite(dbPath);
  if ((!tokens?.accessToken || !tokens?.machineId) && errors.some(isSqliteLockError)) {
    try {
      tokens = withTempDbCopy(dbPath, (copyPath) => extractViaBetterSqlite(copyPath));
      errors.length = 0;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (tokens?.accessToken && tokens.machineId) return { tokens, errors };

  try {
    const cliTokens = await extractViaCli(dbPath);
    if (cliTokens.accessToken && cliTokens.machineId) return { tokens: cliTokens, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    tokens: tokens ?? { accessToken: null, refreshToken: null, machineId: null },
    errors
  };
}

export function cursorAutoImportNotFoundMessage(platform: NodeJS.Platform, candidates: string[]) {
  if (platform === "linux") {
    return [
      "Cursor database tidak ditemukan di server ini.",
      "Auto-import hanya berfungsi jika NesaRouter dan Cursor IDE berjalan di komputer yang sama.",
      "Kalau NesaRouter di VPS, gunakan Paste manually: ambil token dari PC Windows/Mac tempat Cursor terinstall.",
      "",
      "Lokasi yang dicek:",
      ...candidates.map((path) => `- ${path}`)
    ].join("\n");
  }
  return [
    "Cursor database tidak ditemukan di mesin tempat NesaRouter berjalan.",
    "Pastikan Cursor IDE sudah dibuka minimal sekali dan Anda sudah login.",
    "Kalau dashboard dibuka lewat VPS/domain remote, auto-import tidak bisa membaca file di PC lokal — gunakan Paste manually.",
    "",
    "Lokasi yang dicek:",
    ...candidates.map((path) => `- ${path}`)
  ].join("\n");
}

export function cursorAutoImportPartialMessage(dbPath: string, hasAccessToken: boolean, hasMachineId: boolean) {
  const missing = [
    !hasAccessToken ? "access token (cursorAuth/accessToken)" : null,
    !hasMachineId ? "machine id (storage.serviceMachineId)" : null
  ].filter(Boolean);
  return [
    `Database Cursor ditemukan (${dbPath}) tapi ${missing.join(" dan ")} belum ada.`,
    "Login ke Cursor IDE di komputer ini, tutup lalu buka lagi Cursor, kemudian coba Re-import.",
    "Atau gunakan Paste manually."
  ].join(" ");
}
