import { describe, expect, it } from "vitest";
import { mergeRouterPatch, validateStatePatch } from "@/lib/statePatch";
import { defaultStore } from "@/lib/defaults";

describe("state patch validation", () => {
  it("accepts valid partial settings", () => {
    expect(validateStatePatch({ router: { queueWaitMs: 1000, headroomUrl: "http://localhost:8787" } })).toBeNull();
    expect(validateStatePatch({ budget: { dailyBudgetUsd: 5 }, aliases: [] })).toBeNull();
  });

  it("rejects malformed and unsafe settings", () => {
    expect(validateStatePatch(null)).toMatch(/JSON object/);
    expect(validateStatePatch({ router: { queueWaitMs: -1 } })).toMatch(/non-negative/);
    expect(validateStatePatch({ router: { headroomUrl: "file:///etc/passwd" } })).toMatch(/HTTP/);
    expect(validateStatePatch({ router: { surprise: true } })).toMatch(/Unknown router/);
    expect(validateStatePatch({ unexpected: [] })).toMatch(/Unknown state/);
  });

  it("rejects ambiguous combos and aliases in bulk state updates", () => {
    expect(validateStatePatch({ combos: [
      { id: "x", name: "one", providerIds: ["p"], strategy: "fallback" },
      { id: "two", name: "X", providerIds: ["q"], strategy: "fallback" }
    ] })).toMatch(/unique/i);
    expect(validateStatePatch({ combos: [{ id: "x", name: "one", providerIds: [], strategy: "fallback" }] })).toMatch(/providerIds/i);
    expect(validateStatePatch({ combos: [{ id: "x", name: "one", providerIds: ["p", "p"], strategy: "fallback" }] })).toMatch(/only appear once/i);
    expect(validateStatePatch({ aliases: [
      { id: "1", alias: "fast", target: "a" },
      { id: "2", alias: "FAST", target: "b" }
    ] })).toMatch(/unique/i);
  });

  it("deep-merges nested router settings", () => {
    const current = {
      ...defaultStore.router,
      mediaRouting: { imagesProviderId: "images", speechProviderId: "speech" },
      tokenSaver: { caveman: "lite" as const, ponytail: "full" as const }
    };
    const merged = mergeRouterPatch(current, {
      mediaRouting: { imagesProviderId: "new-images" },
      tokenSaver: { caveman: "ultra" }
    });
    expect(merged.mediaRouting).toEqual({ imagesProviderId: "new-images", speechProviderId: "speech" });
    expect(merged.tokenSaver).toEqual({ caveman: "ultra", ponytail: "full" });
  });
});
