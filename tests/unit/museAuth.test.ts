import { describe, expect, it, vi } from "vitest";
import {
  checkMuseMint,
  MUSE_DEFAULT_MINT_URL,
  MUSE_MINT_ATTEMPTS,
  MuseMintError,
  museApiKeyFrom,
  museSessionId,
  mintMuseKey
} from "@/core/museAuth";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("museApiKeyFrom", () => {
  it("accepts every name the mint endpoint uses", () => {
    expect(museApiKeyFrom({ api_key: "a" })).toBe("a");
    expect(museApiKeyFrom({ apiKey: "b" })).toBe("b");
    expect(museApiKeyFrom({ key: "c" })).toBe("c");
    expect(museApiKeyFrom({})).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(museApiKeyFrom({ api_key: "  spaced  " })).toBe("spaced");
  });
});

describe("checkMuseMint", () => {
  it("accepts a minted key and records the account", () => {
    const minted = checkMuseMint({ user_email: "ops@example.com", is_subs_active: true }, "sk-muse");
    expect(minted.apiKey).toBe("sk-muse");
    expect(minted.accountId).toBe("ops@example.com");
  });

  it("rejects an inactive subscription at login instead of storing a key that cannot chat", () => {
    expect(() => checkMuseMint({ is_subs_active: false, user_email: "ops@example.com" }, "sk-muse")).toThrow(
      MuseMintError
    );
    expect(() => checkMuseMint({ is_subs_active: false, user_email: "ops@example.com" }, "sk-muse")).toThrow(
      /subscription is inactive.*ops@example\.com/
    );
  });

  it("reports the subscription action URL when payment is required", () => {
    expect(() => checkMuseMint({ require_payment: true, action_url: "https://meta.ai/pay" }, "")).toThrow(
      /subscription is required: https:\/\/meta\.ai\/pay/
    );
  });

  it("names the missing key when the response simply had none", () => {
    expect(() => checkMuseMint({}, "")).toThrow(/contained no api_key/);
  });
});

describe("mintMuseKey", () => {
  it("mints with the Muse CLI identity and the onboard flag", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ api_key: "sk-muse", user_email: "ops@example.com" }));
    const minted = await mintMuseKey("dca-token", { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(minted.apiKey).toBe("sk-muse");
    expect(minted.accountId).toBe("ops@example.com");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(MUSE_DEFAULT_MINT_URL);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer dca-token");
    expect((init.headers as Record<string, string>)["x-api-version"]).toBe("1.0.0");
    expect(JSON.parse(String(init.body))).toEqual({ onboard: true });
  });

  it("retries a transient 429 and succeeds without failing the login", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? jsonResponse({ error: "slow down" }, 429) : jsonResponse({ api_key: "sk-muse" });
    });
    const sleepImpl = vi.fn(async () => {});

    const minted = await mintMuseKey("dca-token", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl
    });
    expect(minted.apiKey).toBe("sk-muse");
    expect(calls).toBe(2);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up after the bounded attempts and surfaces a sanitized HTTP error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "overloaded" }, 503));
    await expect(
      mintMuseKey("dca-token", { fetchImpl: fetchImpl as unknown as typeof fetch, sleepImpl: async () => {} })
    ).rejects.toThrow(/mint failed \(HTTP 503\)/);
    expect(fetchImpl).toHaveBeenCalledTimes(MUSE_MINT_ATTEMPTS);
  });

  it("does not leak the device token in the error text", async () => {
    const secret = "dca-supersecrettokenvalue1234567890";
    const fetchImpl = vi.fn(async () => new Response(`{"error":"rejected ${secret}"}`, { status: 401 }));
    const error = await mintMuseKey(secret, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => {}
    }).then(
      () => {
        throw new Error("expected mintMuseKey to reject");
      },
      (err: unknown) => err as Error
    );
    expect(String(error.message)).not.toContain(secret);
  });

  it("refuses an empty device token before calling the network", async () => {
    const fetchImpl = vi.fn();
    await expect(
      mintMuseKey("   ", { fetchImpl: fetchImpl as unknown as typeof fetch })
    ).rejects.toThrow(/missing device token/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a non-JSON mint body instead of throwing a parse error", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>gateway</html>", { status: 200 }));
    await expect(
      mintMuseKey("dca-token", { fetchImpl: fetchImpl as unknown as typeof fetch })
    ).rejects.toThrow(/could not read the mint response/);
  });
});

describe("museSessionId", () => {
  it("is stable for one credential and different across credentials", () => {
    const first = museSessionId("sk-muse-a");
    expect(museSessionId("sk-muse-a")).toBe(first);
    expect(museSessionId("sk-muse-b")).not.toBe(first);
  });

  it("looks like a uuid so a header-validating proxy accepts it", () => {
    expect(museSessionId("sk-muse-a")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
