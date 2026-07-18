import { afterEach, describe, expect, it } from "vitest";
import { adminCookieName, buildAdminSessionCookie } from "@/core/adminSessionCookie";
import { adminLoginPasswordHint, adminTokenFromRequest, loginRateLimitKey, readAdminSessionTokenCandidates } from "@/core/adminAuth";
import { createAdminSessionRecord, writeAdminPasswordHash } from "@/lib/store";

describe("admin session token resolution", () => {
  const previousTrustProxy = process.env.NESA_TRUST_PROXY;
  afterEach(async () => {
    if (previousTrustProxy === undefined) delete process.env.NESA_TRUST_PROXY;
    else process.env.NESA_TRUST_PROXY = previousTrustProxy;
    await writeAdminPasswordHash("");
  });

  it("isolates login throttling between clients", () => {
    process.env.NESA_TRUST_PROXY = "true";
    const first = new Request("http://localhost/login", {
      headers: { "x-real-ip": "192.0.2.10", "user-agent": "browser" }
    });
    const same = new Request("http://localhost/login", {
      headers: { "x-real-ip": "192.0.2.10", "user-agent": "browser" }
    });
    const second = new Request("http://localhost/login", {
      headers: { "x-real-ip": "192.0.2.11", "user-agent": "browser" }
    });

    expect(loginRateLimitKey(first)).toBe(loginRateLimitKey(same));
    expect(loginRateLimitKey(first)).not.toBe(loginRateLimitKey(second));
  });

  it("does not trust spoofable client IP headers by default", () => {
    delete process.env.NESA_TRUST_PROXY;
    const first = new Request("http://localhost/login", { headers: { "x-real-ip": "192.0.2.10" } });
    const second = new Request("http://localhost/login", { headers: { "x-real-ip": "192.0.2.11" } });
    expect(loginRateLimitKey(first)).toBe(loginRateLimitKey(second));
  });

  it("reads the session cookie from the raw Cookie header", async () => {
    const cookie = await buildAdminSessionCookie("abcdefghijklmnopqrstuvwxyz0123456789ABCD", Date.now() + 60_000);
    const request = new Request("http://localhost:20129/api/providers", {
      headers: { cookie: `${adminCookieName}=${encodeURIComponent(cookie)}` }
    });

    expect(adminTokenFromRequest(request)).toBe(cookie);
    const candidates = await readAdminSessionTokenCandidates(request);
    expect(candidates).toContain(cookie);
  });

  it("deduplicates identical cookie values from multiple sources", async () => {
    const cookie = await buildAdminSessionCookie("abcdefghijklmnopqrstuvwxyz0123456789ABCD", Date.now() + 60_000);
    const request = new Request("http://localhost:20129/api/providers", {
      headers: { cookie: `${adminCookieName}=${cookie}` }
    });
    const candidates = await readAdminSessionTokenCandidates(request);
    expect(candidates.filter((value) => value === cookie)).toHaveLength(1);
  });

  it("verifies a header-provided session when the DB record exists", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";
    const expMs = Date.now() + 60_000;
    const cookie = await buildAdminSessionCookie(token, expMs);
    const { hashSessionToken } = await import("@/core/adminSessionCookie");
    await createAdminSessionRecord({
      tokenHash: await hashSessionToken(token),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expMs).toISOString()
    });

    const { resolveVerifiedAdminSessionToken } = await import("@/core/adminAuth");
    const request = new Request("http://localhost:20129/api/providers", {
      headers: { cookie: `${adminCookieName}=${cookie}` }
    });
    await expect(resolveVerifiedAdminSessionToken(request)).resolves.toBe(cookie);
  });

  it("never exposes a bootstrap hint after a password hash is stored", async () => {
    await writeAdminPasswordHash("scrypt$stored-password-hash");
    await expect(adminLoginPasswordHint()).resolves.toBeNull();
  });
});
