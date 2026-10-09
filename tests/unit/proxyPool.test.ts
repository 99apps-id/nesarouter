import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PROXY_ATTEMPTS,
  PROXY_POOL_ENV,
  MUSE_PROXY_POOL_ENV,
  callWithProxyPool,
  looksLikeEgressRestriction,
  parseProxyPool,
  proxyPoolFor,
  reportProxyFailure,
  reportProxySuccess,
  resetProxyPoolState,
  selectProxy
} from "@/core/proxyPool";
import { UpstreamProviderError } from "@/core/providers/shared";
import type { ProviderConfig } from "@/core/types";

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv[PROXY_POOL_ENV] = process.env[PROXY_POOL_ENV];
  savedEnv[MUSE_PROXY_POOL_ENV] = process.env[MUSE_PROXY_POOL_ENV];
  delete process.env[PROXY_POOL_ENV];
  delete process.env[MUSE_PROXY_POOL_ENV];
  resetProxyPoolState();
});

afterEach(() => {
  for (const name of [PROXY_POOL_ENV, MUSE_PROXY_POOL_ENV]) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
  resetProxyPoolState();
});

function provider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return { id: "muse-provider", name: "Muse", proxyUrl: undefined, oauthProfile: "muse", ...overrides } as ProviderConfig;
}

describe("parseProxyPool", () => {
  it("accepts comma, semicolon and whitespace separated entries", () => {
    expect(parseProxyPool("http://a:1,http://b:2;http://c:3\nhttp://d:4")).toEqual([
      "http://a:1/",
      "http://b:2/",
      "http://c:3/",
      "http://d:4/"
    ]);
  });

  it("dedupes and keeps credentials in the URL", () => {
    expect(parseProxyPool("http://u:p@a:1, http://u:p@a:1")).toEqual(["http://u:p@a:1/"]);
  });

  it("defaults a scheme-less host:port to http", () => {
    expect(parseProxyPool("1.2.3.4:8080")).toEqual(["http://1.2.3.4:8080/"]);
  });

  it("keeps socks proxies but drops unsupported schemes and junk", () => {
    expect(parseProxyPool("socks5://a:1,ftp://b:2,junk-entry,http://c:3")).toEqual(["socks5://a:1", "http://c:3/"]);
  });

  it("returns an empty pool for empty input", () => {
    expect(parseProxyPool("")).toEqual([]);
    expect(parseProxyPool(undefined)).toEqual([]);
  });
});

describe("proxyPoolFor", () => {
  it("prefers the muse pool for a muse provider and falls back to the generic pool", () => {
    process.env[MUSE_PROXY_POOL_ENV] = "http://muse:1";
    process.env[PROXY_POOL_ENV] = "http://generic:1";
    expect(proxyPoolFor(provider())).toEqual(["http://muse:1/"]);

    delete process.env[MUSE_PROXY_POOL_ENV];
    expect(proxyPoolFor(provider())).toEqual(["http://generic:1/"]);
  });

  it("gives a non-muse provider only the generic pool", () => {
    process.env[MUSE_PROXY_POOL_ENV] = "http://muse:1";
    process.env[PROXY_POOL_ENV] = "http://generic:1";
    expect(proxyPoolFor(provider({ oauthProfile: "grok_cli" }))).toEqual(["http://generic:1/"]);
  });

  it("returns no pool when nothing is configured", () => {
    expect(proxyPoolFor(provider())).toEqual([]);
  });
});

describe("selectProxy", () => {
  const pool = ["http://a:1", "http://b:2"];

  it("keeps a credential pinned to the proxy that already worked", () => {
    reportProxySuccess("acct", "http://b:2");
    expect(selectProxy(pool, "acct", new Set())).toBe("http://b:2");
  });

  it("spreads load to the least recently used proxy", () => {
    reportProxySuccess("one", "http://a:1");
    expect(selectProxy(pool, "two", new Set())).toBe("http://b:2");
  });

  it("never returns an already tried proxy", () => {
    expect(selectProxy(pool, "acct", new Set(["http://a:1"]))).toBe("http://b:2");
    expect(selectProxy(pool, "acct", new Set(pool))).toBeUndefined();
  });

  it("skips a cooling proxy and drops the pin that pointed at it", () => {
    reportProxySuccess("acct", "http://a:1");
    reportProxyFailure("http://a:1");
    expect(selectProxy(pool, "acct", new Set())).toBe("http://b:2");
    expect(selectProxy(["http://a:1"], "acct", new Set())).toBeUndefined();
  });
});

describe("looksLikeEgressRestriction", () => {
  it("treats a model unavailable to this address as an egress refusal", () => {
    expect(looksLikeEgressRestriction(403, "Meta does not offer muse-spark-1.3 to user at https://api.meta.ai/v1")).toBe(
      true
    );
    expect(looksLikeEgressRestriction(404, "model is not available in your region")).toBe(true);
  });

  it("treats proxy credentials failing as a reason to try another proxy", () => {
    expect(looksLikeEgressRestriction(407, "Proxy Authentication Required")).toBe(true);
  });

  it("does not retry a genuinely malformed request or a server fault", () => {
    expect(looksLikeEgressRestriction(400, "invalid temperature: must be <= 2")).toBe(false);
    expect(looksLikeEgressRestriction(400, "unknown field 'foo'")).toBe(false);
    expect(looksLikeEgressRestriction(500, "internal error")).toBe(false);
    expect(looksLikeEgressRestriction(200, "ok")).toBe(false);
  });
});

describe("callWithProxyPool", () => {
  const pool = ["http://a:1", "http://b:2", "http://c:3"];

  it("retries the next egress after an entitlement refusal and returns the success", async () => {
    const seen: (string | undefined)[] = [];
    const answer = await callWithProxyPool(provider(), pool, async (routed) => {
      seen.push(routed.proxyUrl);
      if (routed.proxyUrl !== "http://c:3") {
        throw new UpstreamProviderError("model is not available in your region", 403);
      }
      return "ok";
    });

    expect(answer).toBe("ok");
    expect(seen).toEqual(["http://a:1", "http://b:2", "http://c:3"]);
  });

  it("throws a real error immediately without burning the pool", async () => {
    const seen: (string | undefined)[] = [];
    await expect(
      callWithProxyPool(provider(), pool, async (routed) => {
        seen.push(routed.proxyUrl);
        throw new UpstreamProviderError("invalid temperature", 400);
      })
    ).rejects.toThrow(/invalid temperature/);
    expect(seen).toHaveLength(1);
  });

  it("reports the last refusal when every egress is unentitled", async () => {
    await expect(
      callWithProxyPool(provider(), pool, async () => {
        throw new UpstreamProviderError("model is not available in your region", 404);
      })
    ).rejects.toThrow(/not available in your region/);
  });

  it("caps the number of attempts for a large pool", async () => {
    const big = Array.from({ length: 12 }, (_, index) => `http://p${index}:1`);
    let attempts = 0;
    await expect(
      callWithProxyPool(provider(), big, async () => {
        attempts += 1;
        throw new UpstreamProviderError("not available in your region", 403);
      })
    ).rejects.toThrow();
    expect(attempts).toBe(MAX_PROXY_ATTEMPTS);
  });

  it("does not send a request at all when every proxy is cooling", async () => {
    for (const proxy of pool) reportProxyFailure(proxy);
    let attempts = 0;
    await expect(
      callWithProxyPool(provider(), pool, async () => {
        attempts += 1;
        return "ok";
      })
    ).rejects.toThrow(/No proxy in the pool is currently healthy/);
    expect(attempts).toBe(0);
  });
});
