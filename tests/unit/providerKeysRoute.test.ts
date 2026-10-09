import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/providers/[id]/keys/route";
import { buildAdminSessionCookie, hashSessionToken } from "@/core/adminSessionCookie";
import { createAdminSessionRecord, writeAdminPasswordHash } from "@/lib/adminPersistence";
import { deleteProvider, readProviderById, updateProvider } from "@/lib/store";
import { ProviderConfig } from "@/core/types";

const providerId = "keys-route-test";
const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";

async function adminRequest(body: unknown): Promise<Request> {
  const expMs = Date.now() + 60_000;
  const cookie = await buildAdminSessionCookie(token, expMs);
  await createAdminSessionRecord({
    tokenHash: await hashSessionToken(token),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(expMs).toISOString()
  });
  return new Request(`http://localhost:20129/api/providers/${providerId}/keys`, {
    method: "POST",
    headers: { cookie: `nesa_admin_session=${encodeURIComponent(cookie)}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const context = { params: Promise.resolve({ id: providerId }) };

describe("provider key add", () => {
  beforeAll(async () => {
    await writeAdminPasswordHash("scrypt:stored:hash");
    const provider: ProviderConfig = {
      id: providerId,
      name: "Keys route test",
      type: "openai_compatible",
      tier: "cheap",
      status: "active",
      baseUrl: "https://example.com/v1",
      apiKey: "key-a",
      apiKeys: ["key-b", "key-c"],
      model: "m",
      priority: 50,
      inputCostPerMTok: 0,
      outputCostPerMTok: 0
    };
    await updateProvider(provider);
  });

  afterAll(async () => {
    await deleteProvider(providerId);
    await writeAdminPasswordHash("");
  });

  it("rejects a duplicate key instead of silently reporting success", async () => {
    const response = await POST(await adminRequest({ key: "key-b", quotaLimitTokens: 1000 }), context);
    expect(response.status).toBe(409);
    const provider = await readProviderById(providerId);
    // The quota must not land on the last key (index count-1) when the key was already stored.
    expect((provider?.keyQuotas ?? []).some((entry) => Boolean(entry?.quotaLimitTokens))).toBe(false);
    expect(provider?.apiKeys).toEqual(["key-b", "key-c"]);
  });

  it("appends a new key and its quota on the right index", async () => {
    const response = await POST(await adminRequest({ key: "key-d", quotaLimitTokens: 2000 }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, count: 4 });
    const provider = await readProviderById(providerId);
    expect(provider?.apiKeys).toEqual(["key-b", "key-c", "key-d"]);
    expect(provider?.keyQuotas?.[3]).toEqual({ quotaLimitTokens: 2000 });
  });
});
