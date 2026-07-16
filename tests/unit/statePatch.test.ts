import { describe, expect, it } from "vitest";
import { validateStatePatch } from "@/lib/statePatch";

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
});
