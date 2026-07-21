import { describe, expect, it } from "vitest";
import { safeTokenCount } from "@/core/chatHandler";

describe("usage ingestion", () => {
  it("rejects negative and non-finite upstream token counts", () => {
    expect(safeTokenCount(-5, 12)).toBe(12);
    expect(safeTokenCount("not-a-number", 12)).toBe(12);
    expect(safeTokenCount(Infinity, 12)).toBe(12);
  });

  it("normalizes valid fractional and numeric-string counts", () => {
    expect(safeTokenCount(10.9)).toBe(10);
    expect(safeTokenCount("42")).toBe(42);
  });
});
