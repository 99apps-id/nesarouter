import crypto from "node:crypto";
import {
  clearLoginLockState,
  createAdminSessionRecord,
  deleteAdminSessionByHash,
  deleteAllAdminSessions,
  findAdminSessionByHash,
  readAdminPasswordHash,
  readLoginLockState,
  writeLoginLockState
} from "@/lib/store";
import {
  adminCookieName,
  buildAdminSessionCookie,
  hashSessionToken,
  peekAdminCookie,
  SESSION_TTL_MS,
  timingSafeEqualString
} from "@/core/adminSessionCookie";

export { adminCookieName, peekAdminCookie, timingSafeEqualString } from "@/core/adminSessionCookie";

export const defaultAdminPassword = "nesa123456";

export async function adminAuthEnabled() {
  return true;
}

function bootstrapPassword() {
  const password = process.env.NESA_ADMIN_PASSWORD?.trim();
  if (process.env.NODE_ENV === "production" && (!password || password === defaultAdminPassword || password === "change-me")) {
    throw new Error("Set a unique NESA_ADMIN_PASSWORD before starting NesaRouter in production.");
  }
  return password || defaultAdminPassword;
}

export async function adminPasswordMustChange() {
  return !(await readAdminPasswordHash());
}

/**
 * Show the well-known local bootstrap password on /login only while no hash
 * exists and the operator is still on the default (not a custom NESA_ADMIN_PASSWORD).
 */
export async function shouldShowBootstrapPasswordHint() {
  if (await readAdminPasswordHash()) return false;
  const fromEnv = process.env.NESA_ADMIN_PASSWORD?.trim();
  return !fromEnv || fromEnv === defaultAdminPassword;
}

export async function readLoginLock() {
  const state = await readLoginLockState();
  const lockedUntilTime = state.lockedUntil ? new Date(state.lockedUntil).getTime() : 0;
  if (lockedUntilTime && lockedUntilTime <= Date.now()) {
    await clearLoginLockState();
    return { failedAttempts: 0, locked: false, remainingMs: 0 };
  }

  return {
    failedAttempts: state.failedAttempts,
    locked: Boolean(lockedUntilTime),
    lockedUntil: state.lockedUntil,
    remainingMs: lockedUntilTime ? Math.max(0, lockedUntilTime - Date.now()) : 0
  };
}

export async function recordLoginFailure() {
  const state = await readLoginLockState();
  const failedAttempts = state.failedAttempts + 1;
  const lockedUntil = failedAttempts >= 3 ? new Date(Date.now() + 30 * 60_000).toISOString() : undefined;
  await writeLoginLockState({ failedAttempts, lockedUntil });
  return readLoginLock();
}

export async function recordLoginSuccess() {
  await clearLoginLockState();
}

export function hashAdminPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, salt, 32).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

function verifyPasswordHash(password: string, storedHash: string) {
  const [scheme, salt, hash] = storedHash.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "base64url");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function verifyAdminPassword(password: string) {
  const storedHash = await readAdminPasswordHash();
  if (storedHash) return verifyPasswordHash(password, storedHash);

  const left = Buffer.from(password);
  const right = Buffer.from(bootstrapPassword());
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Issue a random, revocable admin session cookie value. */
export async function createAdminSession() {
  const token = crypto.randomBytes(32).toString("base64url");
  const expMs = Date.now() + SESSION_TTL_MS;
  await createAdminSessionRecord({
    tokenHash: await hashSessionToken(token),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(expMs).toISOString()
  });
  return buildAdminSessionCookie(token, expMs);
}

/** @deprecated alias — prefer createAdminSession */
export async function adminSessionToken() {
  return createAdminSession();
}

export async function verifyAdminToken(cookieValue?: string) {
  const peeked = await peekAdminCookie(cookieValue);
  if (!peeked) return false;
  const tokenHash = await hashSessionToken(peeked.token);
  const record = await findAdminSessionByHash(tokenHash);
  if (!record) return false;
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await deleteAdminSessionByHash(tokenHash);
    return false;
  }
  return true;
}

export async function revokeAdminToken(cookieValue?: string) {
  const peeked = await peekAdminCookie(cookieValue);
  if (!peeked) return;
  await deleteAdminSessionByHash(await hashSessionToken(peeked.token));
}

export async function revokeAllAdminSessions() {
  await deleteAllAdminSessions();
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  };
}

export function adminTokenFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${adminCookieName}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
