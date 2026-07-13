import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  clearLoginLockState,
  createAdminSessionRecord,
  deleteAdminSessionByHash,
  deleteAllAdminSessions,
  findAdminSessionByHash,
  readAdminPasswordHash,
  readLoginLockState,
  touchAdminSessionExpiry,
  writeLoginLockState
} from "@/lib/store";
import {
  adminCookieName,
  buildAdminSessionCookie,
  hashSessionToken,
  peekAdminCookie,
  peekAdminCookieLenient,
  SESSION_TTL_MS,
  timingSafeEqualString
} from "@/core/adminSessionCookie";
import { cookieSecurePreferred } from "@/core/publicUrl";

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
 * Login hint mode while no password hash exists yet.
 * - default: show well-known local bootstrap password
 * - env: custom NESA_ADMIN_PASSWORD is set (do not echo it; point at .env)
 * - null: password already changed (hash stored)
 */
export async function adminLoginPasswordHint(): Promise<"default" | "env" | null> {
  if (await readAdminPasswordHash()) return null;
  const fromEnv = process.env.NESA_ADMIN_PASSWORD?.trim();
  if (!fromEnv || fromEnv === defaultAdminPassword) return "default";
  return "env";
}

/** @deprecated use adminLoginPasswordHint */
export async function shouldShowBootstrapPasswordHint() {
  return (await adminLoginPasswordHint()) === "default";
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
  const peeked = await peekAdminCookieLenient(cookieValue);
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

/** Collect session cookie values from every server-visible source (proxy-safe). */
export async function readAdminSessionTokenCandidates(request?: Request): Promise<string[]> {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const add = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  // Prefer the raw Cookie header on API requests — more reliable behind reverse proxies
  // than cookies() alone, which can occasionally disagree with the browser jar.
  if (request) add(adminTokenFromRequest(request));
  try {
    add((await cookies()).get(adminCookieName)?.value);
  } catch {
    /* cookies() unavailable outside a request context */
  }

  return candidates;
}

/** Return the first session token that passes full verify (HMAC + DB). */
export async function resolveVerifiedAdminSessionToken(request?: Request): Promise<string | undefined> {
  for (const candidate of await readAdminSessionTokenCandidates(request)) {
    if (await verifyAdminToken(candidate)) return candidate;
  }
  return undefined;
}

/** Refresh Set-Cookie after a verified admin API call (extends cookie + DB TTL). */
export async function refreshAdminSessionCookie(
  sessionToken: string,
  request?: Request
): Promise<{ value: string; options: ReturnType<typeof adminCookieOptions> } | null> {
  const peeked = await peekAdminCookieLenient(sessionToken);
  if (!peeked) return null;
  const tokenHash = await hashSessionToken(peeked.token);
  const record = await findAdminSessionByHash(tokenHash);
  if (!record || new Date(record.expiresAt).getTime() <= Date.now()) return null;

  const expMs = Date.now() + SESSION_TTL_MS;
  await touchAdminSessionExpiry(tokenHash, new Date(expMs).toISOString());
  return {
    value: await buildAdminSessionCookie(peeked.token, expMs),
    options: adminCookieOptions(request)
  };
}

export async function revokeAdminToken(cookieValue?: string) {
  const peeked = await peekAdminCookieLenient(cookieValue);
  if (!peeked) return;
  await deleteAdminSessionByHash(await hashSessionToken(peeked.token));
}

export async function revokeAllAdminSessions() {
  await deleteAllAdminSessions();
}

export function adminCookieOptions(request?: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecurePreferred(request),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  };
}

export function adminTokenFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${adminCookieName}=([^;]*)`));
  if (!match?.[1]) return undefined;
  const raw = match[1].trim().replace(/^"|"$/g, "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
