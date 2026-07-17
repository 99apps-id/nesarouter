import crypto from "node:crypto";
import { CacheEntry, NesaStore } from "@/core/types";

export function cacheKeyForBody(body: any) {
  // Exclude transport-only fields; all generation-affecting options belong in
  // the key so provider-specific knobs cannot collide with another response.
  const { stream: _stream, stream_options: _streamOptions, ...semantic } = body ?? {};
  const stable = stableStringify(semantic);
  return crypto.createHash("sha256").update(stable).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function findCache(store: NesaStore, key: string) {
  return store.cache.find((entry) => entry.key === key);
}

export function addCacheEntry(store: NesaStore, entry: CacheEntry) {
  store.cache = [entry, ...store.cache.filter((item) => item.key !== entry.key)].slice(0, 100);
}
