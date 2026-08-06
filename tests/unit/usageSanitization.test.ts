import { describe, expect, it } from "vitest";
import { safeTokenCount, sanitizeHeaderValue, tokenSaverBypassed } from "@/core/chatHandler";

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

describe("sanitizeHeaderValue", () => {
  it("strips CR/LF so a routing reason cannot inject extra headers", () => {
    expect(sanitizeHeaderValue("line one\r\nX-Injected: evil\nline two")).toBe("line one X-Injected: evil line two");
  });

  it("bounds length", () => {
    expect(sanitizeHeaderValue("a".repeat(500), 10)).toBe("a".repeat(10));
  });
});

describe("tokenSaverBypassed", () => {
  it("recognizes off/0/false (case-insensitive) on X-Nesa-Token-Saver", () => {
    for (const value of ["off", "OFF", "0", "false", "False"]) {
      expect(tokenSaverBypassed(new Request("http://x", { headers: { "x-nesa-token-saver": value } }))).toBe(true);
    }
  });

  it("ignores unset or unrecognized values", () => {
    expect(tokenSaverBypassed(new Request("http://x"))).toBe(false);
    expect(tokenSaverBypassed(new Request("http://x", { headers: { "x-nesa-token-saver": "on" } }))).toBe(false);
  });
});
