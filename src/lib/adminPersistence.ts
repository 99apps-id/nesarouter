import { getDb } from "@/lib/store";

export interface AdminSessionRecord {
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface LoginLockState {
  failedAttempts: number;
  lockedUntil?: string;
}

export async function readAdminPasswordHash(): Promise<string | null> {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("adminPasswordHash") as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export async function writeAdminPasswordHash(hash: string) {
  getDb()
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run("adminPasswordHash", hash);
}

export async function createAdminSessionRecord(session: AdminSessionRecord) {
  const database = getDb();
  database
    .prepare(
      "INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?) ON CONFLICT(token_hash) DO UPDATE SET created_at = excluded.created_at, expires_at = excluded.expires_at"
    )
    .run(session.tokenHash, session.createdAt, session.expiresAt);
  database.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").run(new Date().toISOString());
}

export async function findAdminSessionByHash(tokenHash: string): Promise<AdminSessionRecord | null> {
  return (
    (getDb()
      .prepare(
        "SELECT token_hash as tokenHash, created_at as createdAt, expires_at as expiresAt FROM admin_sessions WHERE token_hash = ?"
      )
      .get(tokenHash) as AdminSessionRecord | undefined) ?? null
  );
}

export async function deleteAdminSessionByHash(tokenHash: string) {
  getDb().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
}

export async function deleteAllAdminSessions() {
  getDb().prepare("DELETE FROM admin_sessions").run();
}

export async function touchAdminSessionExpiry(tokenHash: string, expiresAt: string) {
  getDb()
    .prepare("UPDATE admin_sessions SET expires_at = ? WHERE token_hash = ?")
    .run(expiresAt, tokenHash);
}

function loginLockSettingKey(lockKey = "default") {
  return `loginLock:${lockKey}`;
}

function readLoginLockSetting(lockKey: string): LoginLockState {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(loginLockSettingKey(lockKey)) as { value: string } | undefined;
  if (!row) return { failedAttempts: 0 };
  try {
    return JSON.parse(row.value) as LoginLockState;
  } catch {
    return { failedAttempts: 0 };
  }
}

export async function readLoginLockState(lockKey = "default"): Promise<LoginLockState> {
  return readLoginLockSetting(lockKey);
}

export async function writeLoginLockState(state: LoginLockState, lockKey = "default") {
  getDb()
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run(loginLockSettingKey(lockKey), JSON.stringify(state));
}

export async function clearLoginLockState(lockKey = "default") {
  await writeLoginLockState({ failedAttempts: 0 }, lockKey);
}
