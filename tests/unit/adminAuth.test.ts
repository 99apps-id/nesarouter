import { describe, expect, it } from "vitest";
import { adminCookieName, buildAdminSessionCookie } from "@/core/adminSessionCookie";
import { adminTokenFromRequest, readAdminSessionTokenCandidates } from "@/core/adminAuth";
import { createAdminSessionRecord } from "@/lib/store";

describe("admin session token resolution", () => {
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
});
