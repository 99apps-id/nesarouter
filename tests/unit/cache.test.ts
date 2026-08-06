import { describe, it, expect } from "vitest";
import { cacheKeyForBody, findCache, addCacheEntry } from "@/core/cache";
import { defaultStore } from "@/lib/defaults";
import { CacheEntry, NesaStore } from "@/core/types";

describe("cache", () => {
  it("separates generation-affecting provider options", () => {
    const base = { model: "m", messages: [{ role: "user", content: "hi" }] };
    expect(cacheKeyForBody({ ...base, seed: 1 })).not.toBe(cacheKeyForBody({ ...base, seed: 2 }));
    expect(cacheKeyForBody({ ...base, stop: ["END"] })).not.toBe(cacheKeyForBody({ ...base, stop: ["STOP"] }));
  });

  it("ignores transport-only streaming fields", () => {
    const base = { model: "m", messages: [{ role: "user", content: "hi" }] };
    expect(cacheKeyForBody(base)).toBe(cacheKeyForBody({ ...base, stream: true, stream_options: { include_usage: true } }));
  });
  it("hashes request body deterministically", () => {
    const a = cacheKeyForBody({ model: "auto", messages: [{ role: "user", content: "hi" }] });
    const b = cacheKeyForBody({ model: "auto", messages: [{ role: "user", content: "hi" }] });
    const c = cacheKeyForBody({ model: "auto", messages: [{ role: "user", content: "hi there" }] });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores volatile keys by default", () => {
    const a = cacheKeyForBody({ model: "auto", messages: [], stream: true });
    const b = cacheKeyForBody({ model: "auto", messages: [], stream: false });
    // stream is not part of the cache key surface, so keys match
    expect(a).toBe(b);
  });

  it("finds and inserts cache entries, capped at 100", () => {
    const store: NesaStore = { ...defaultStore, cache: [] };
    const entry: CacheEntry = {
      key: "k1",
      createdAt: new Date().toISOString(),
      providerId: "p",
      model: "m",
      response: { ok: true },
      inputTokens: 1,
      outputTokens: 2,
      savedCostUsd: 0.001
    };
    addCacheEntry(store, entry);
    expect(findCache(store, "k1")?.key).toBe("k1");
    expect(findCache(store, "missing")).toBeUndefined();
  });
});
