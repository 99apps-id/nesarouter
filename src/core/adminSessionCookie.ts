/**
 * Cookie helpers shared by Edge middleware and Node route handlers.
 * Uses Web Crypto so middleware does not pull better-sqlite3 / node:crypto.
 */

export const adminCookieName = "nesa_admin_session";
const DEFAULT_SESSION_TTL_HOURS = 24 * 7;
const MAX_SESSION_TTL_HOURS = 24 * 365;

function readSessionTtlHours() {
  const raw = process.env.NESA_SESSION_TTL_HOURS?.trim();
  if (!raw) return DEFAULT_SESSION_TTL_HOURS;
  const hours = Number(raw);
  return Number.isFinite(hours) && hours > 0 && hours <= MAX_SESSION_TTL_HOURS
    ? hours
    : DEFAULT_SESSION_TTL_HOURS;
}

/** Sliding admin session lifetime (default 7 days). Override with NESA_SESSION_TTL_HOURS. */
export const SESSION_TTL_MS = readSessionTtlHours() * 60 * 60 * 1000;
export const COOKIE_PREFIX = "nesa1";

function sessionHmacSecret() {
  const fromEnv = process.env.NESA_ADMIN_SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const fallback = process.env.NESA_ENCRYPTION_KEY?.trim();
  if (fallback) return fallback;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NESA_ADMIN_SESSION_SECRET (or NESA_ENCRYPTION_KEY) is required in production.");
  }
  return "nesa-router-dev";
}

function getSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto SubtleCrypto is required for admin session cookies.");
  return subtle;
}

async function hmacKey() {
  const enc = new TextEncoder();
  return getSubtle().importKey(
    "raw",
    enc.encode(sessionHmacSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export async function timingSafeEqualString(a: string, b: string) {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}

export async function hashSessionToken(token: string) {
  const digest = await getSubtle().digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signSessionPayload(token: string, expMs: number) {
  const key = await hmacKey();
  const sig = await getSubtle().sign("HMAC", key, new TextEncoder().encode(`${token}.${expMs}`));
  return bytesToBase64Url(sig);
}

export async function buildAdminSessionCookie(token: string, expMs = Date.now() + SESSION_TTL_MS) {
  const sig = await signSessionPayload(token, expMs);
  return `${COOKIE_PREFIX}.${token}.${expMs}.${sig}`;
}

/**
 * Edge-safe shape check only (no HMAC). Full crypto verify runs in Node route
 * handlers — Edge middleware often lacks runtime NESA_ENCRYPTION_KEY after
 * Docker/standalone builds, which previously rejected valid sessions.
 */
export function hasAdminSessionCookieShape(cookieValue?: string | null): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 4 || parts[0] !== COOKIE_PREFIX) return false;
  const [, token, expRaw, sig] = parts;
  if (!token || !sig || !/^[A-Za-z0-9_-]{32,}$/.test(token)) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(sig)) return false;
  const expMs = Number(expRaw);
  return Number.isFinite(expMs) && expMs > Date.now();
}

/**
 * Edge middleware gate: format + HMAC fields only (no embedded expMs check).
 * Node handlers verify DB expiry and refresh the cookie on activity.
 */
export function hasAdminSessionCookieLenientShape(cookieValue?: string | null): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 4 || parts[0] !== COOKIE_PREFIX) return false;
  const [, token, expRaw, sig] = parts;
  if (!token || !sig || !/^[A-Za-z0-9_-]{32,}$/.test(token)) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(sig)) return false;
  return Number.isFinite(Number(expRaw));
}

export function isMalformedAdminSessionCookie(cookieValue?: string | null): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  return parts.length !== 4 || parts[0] !== COOKIE_PREFIX;
}

/** Edge-safe shape + HMAC check (no DB). Full revoke still happens in verifyAdminToken. */
export async function peekAdminCookie(cookieValue?: string | null): Promise<{ token: string; expMs: number } | null> {
  if (!hasAdminSessionCookieShape(cookieValue)) return null;
  const parts = cookieValue!.split(".");
  const [, token, expRaw, sig] = parts;
  const expMs = Number(expRaw);
  const expected = await signSessionPayload(token!, expMs);
  if (!(await timingSafeEqualString(sig!, expected))) return null;
  // String compare of the HMAC is sufficient; SubtleCrypto.verify is best-effort
  // (padding/encoding differences behind some runtimes previously rejected valid cookies).
  return { token: token!, expMs };
}

/** HMAC verify without rejecting on embedded cookie expMs (DB expiry is authoritative). */
export async function peekAdminCookieLenient(cookieValue?: string | null): Promise<{ token: string; expMs: number } | null> {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 4 || parts[0] !== COOKIE_PREFIX) return null;
  const [, token, expRaw, sig] = parts;
  const expMs = Number(expRaw);
  if (!token || !sig || !/^[A-Za-z0-9_-]{32,}$/.test(token)) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(sig) || !Number.isFinite(expMs)) return null;
  const expected = await signSessionPayload(token, expMs);
  if (!(await timingSafeEqualString(sig, expected))) return null;
  return { token, expMs };
}
