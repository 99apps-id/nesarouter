import crypto from "node:crypto";
import { CacheEntry, NesaStore } from "@/core/types";

export function cacheKeyForBody(body: any) {
  const stable = JSON.stringify({
    model: body?.model ?? null,
    messages: body?.messages ?? null,
    input: body?.input ?? null,
    temperature: body?.temperature ?? null,
    top_p: body?.top_p ?? null,
    max_tokens: body?.max_tokens ?? null,
    response_format: body?.response_format ?? null,
    tools: body?.tools ?? null,
    tool_choice: body?.tool_choice ?? null
  });
  return crypto.createHash("sha256").update(stable).digest("hex");
}

export function findCache(store: NesaStore, key: string) {
  return store.cache.find((entry) => entry.key === key);
}

export function addCacheEntry(store: NesaStore, entry: CacheEntry) {
  store.cache = [entry, ...store.cache.filter((item) => item.key !== entry.key)].slice(0, 100);
}
