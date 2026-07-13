import { describe, expect, it } from "vitest";
import {
  buildAdminSessionCookie,
  hasAdminSessionCookieShape,
  peekAdminCookie,
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
  });

  it("compares oauth state timing-safely", async () => {
    expect(await timingSafeEqualString("abc", "abc")).toBe(true);
    expect(await timingSafeEqualString("abc", "abd")).toBe(false);
    expect(await timingSafeEqualString("abc", "abcd")).toBe(false);
  });
});
