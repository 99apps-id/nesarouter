import { describe, expect, it } from "vitest";
import {
  buildAdminSessionCookie,
  hasAdminSessionCookieLenientShape,
  hasAdminSessionCookieShape,
  peekAdminCookie,
  peekAdminCookieLenient,
  SESSION_TTL_MS,
  timingSafeEqualString
} from "@/core/adminSessionCookie";

describe("admin session cookie", () => {
  it("round-trips a signed cookie", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";
    const cookie = await buildAdminSessionCookie(token, Date.now() + 60_000);
    const peeked = await peekAdminCookie(cookie);
    expect(peeked?.token).toBe(token);
    expect(hasAdminSessionCookieShape(cookie)).toBe(true);
  });

  it("uses the configured session lifetime by default", async () => {
    const before = Date.now();
    const cookie = await buildAdminSessionCookie("abcdefghijklmnopqrstuvwxyz0123456789ABCD");
    const peeked = await peekAdminCookie(cookie);
    expect(peeked?.expMs).toBeGreaterThanOrEqual(before + SESSION_TTL_MS - 1_000);
    expect(peeked?.expMs).toBeLessThanOrEqual(Date.now() + SESSION_TTL_MS + 1_000);
  });

  it("accepts cookie shape without verifying HMAC", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";
    const cookie = `nesa1.${token}.${Date.now() + 60_000}.fakesignaturevaluehere`;
    expect(hasAdminSessionCookieShape(cookie)).toBe(true);
    expect(await peekAdminCookie(cookie)).toBeNull();
  });

  it("rejects tampered signatures", async () => {
    const cookie = await buildAdminSessionCookie("abcdefghijklmnopqrstuvwxyz0123456789ABCD", Date.now() + 60_000);
    const bad = `${cookie.slice(0, -4)}XXXX`;
    expect(await peekAdminCookie(bad)).toBeNull();
    expect(await peekAdminCookieLenient(bad)).toBeNull();
  });

  it("lenient peek accepts expired embedded expMs when HMAC is valid", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";
    const cookie = await buildAdminSessionCookie(token, Date.now() - 60_000);
    expect(hasAdminSessionCookieShape(cookie)).toBe(false);
    expect(await peekAdminCookie(cookie)).toBeNull();
    expect((await peekAdminCookieLenient(cookie))?.token).toBe(token);
  });

  it("lenient middleware shape accepts expired embedded expMs", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";
    const cookie = await buildAdminSessionCookie(token, Date.now() - 60_000);
    expect(hasAdminSessionCookieShape(cookie)).toBe(false);
    expect(hasAdminSessionCookieLenientShape(cookie)).toBe(true);
  });

  it("compares oauth state timing-safely", async () => {
    expect(await timingSafeEqualString("abc", "abc")).toBe(true);
    expect(await timingSafeEqualString("abc", "abd")).toBe(false);
    expect(await timingSafeEqualString("abc", "abcd")).toBe(false);
  });
});
