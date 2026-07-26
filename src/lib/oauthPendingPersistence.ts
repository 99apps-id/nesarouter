import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/store";

export interface OAuthPendingState {
  providerId: string;
  accountId?: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: string;
}

export interface DevicePendingState {
  deviceCode: string;
  createdAt: string;
  /** Absolute expiry from upstream `expires_in` (preferred over hardcoded 15m). */
  expiresAt?: string;
  accountId?: string;
  clientId?: string;
  clientSecret?: string;
  region?: string;
  /** PKCE verifier for Qwen device flow. */
  codeVerifier?: string;
}

function writePendingSetting(key: string, value: unknown) {
  getDb()
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run(key, JSON.stringify(value));
}

function readPendingSetting<T>(key: string): T | null {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

function purgeExpiredPending(now = Date.now()) {
  const database = getDb();
  const rows = database
    .prepare("SELECT key, value FROM settings WHERE key LIKE 'oauthPending:%' OR key LIKE 'devicePending:%'")
    .all() as Array<{ key: string; value: string }>;
  const remove = database.prepare("DELETE FROM settings WHERE key = ?");
  for (const row of rows) {
    try {
      const value = JSON.parse(row.value) as { createdAt?: string; expiresAt?: string };
      const createdAt = value.createdAt ? new Date(value.createdAt).getTime() : NaN;
      const expiresAt = value.expiresAt ? new Date(value.expiresAt).getTime() : NaN;
      const expired = Number.isFinite(expiresAt)
        ? expiresAt <= now
        : !Number.isFinite(createdAt) || now - createdAt > 60 * 60_000;
      if (expired) remove.run(row.key);
    } catch {
      remove.run(row.key);
    }
  }
}

export async function saveOAuthPending(state: string, data: OAuthPendingState) {
  purgeExpiredPending();
  writePendingSetting(`oauthPending:${state}`, {
    ...data,
    codeVerifier: encryptSecret(data.codeVerifier)
  });
}

export async function readOAuthPending(state: string): Promise<OAuthPendingState | null> {
  const pending = readPendingSetting<OAuthPendingState>(`oauthPending:${state}`);
  if (!pending) return null;
  return {
    ...pending,
    codeVerifier: decryptSecret(pending.codeVerifier)
  };
}

export async function deleteOAuthPending(state: string) {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(`oauthPending:${state}`);
}

export async function saveDevicePending(providerId: string, data: DevicePendingState, pendingId?: string) {
  purgeExpiredPending();
  const key = pendingId ? `devicePending:${providerId}:${pendingId}` : `devicePending:${providerId}`;
  writePendingSetting(key, {
    ...data,
    // pendingId isolates concurrent flows. A new account has no accountId
    // until token exchange creates it.
    accountId: data.accountId,
    deviceCode: encryptSecret(data.deviceCode),
    clientSecret: data.clientSecret ? encryptSecret(data.clientSecret) : undefined,
    codeVerifier: data.codeVerifier ? encryptSecret(data.codeVerifier) : undefined
  });
}

export async function readDevicePending(providerId: string, pendingId?: string): Promise<DevicePendingState | null> {
  const key = pendingId ? `devicePending:${providerId}:${pendingId}` : `devicePending:${providerId}`;
  const pending = readPendingSetting<DevicePendingState>(key);
  if (!pending) return null;
  return {
    ...pending,
    deviceCode: decryptSecret(pending.deviceCode),
    clientSecret: pending.clientSecret ? decryptSecret(pending.clientSecret) : undefined,
    codeVerifier: pending.codeVerifier ? decryptSecret(pending.codeVerifier) : undefined
  };
}

function listDevicePendingKeys(providerId: string) {
  const rows = getDb()
    .prepare("SELECT key FROM settings WHERE key LIKE ?")
    .all(`devicePending:${providerId}:%`) as Array<{ key: string }>;
  return rows.map((row) => row.key);
}

export async function deleteDevicePending(providerId: string, pendingId?: string) {
  if (pendingId) {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(`devicePending:${providerId}:${pendingId}`);
    return;
  }
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(`devicePending:${providerId}`);
  for (const key of listDevicePendingKeys(providerId)) {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  }
}
