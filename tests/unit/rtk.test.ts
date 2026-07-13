import { describe, it, expect } from "vitest";
import { compressToolResults } from "@/core/rtk";

describe("rtk", () => {
  it("leaves small tool results untouched", () => {
    const body = { messages: [{ role: "tool", content: "short output" }] };
    const { body: out, savedChars } = compressToolResults(body);
    expect(out).toBe(body);
    expect(savedChars).toBe(0);
  });

  it("truncates or dedups long unstructured tool results", () => {
    const long = Array.from({ length: 300 }, (_, i) => `log line ${i} ${"x".repeat(20)}`).join("\n");
    const body = { messages: [{ role: "tool", content: long }] };
    const { body: out, savedChars } = compressToolResults(body);
    expect(savedChars).toBeGreaterThan(0);
    expect(out.messages[0].content.length).toBeLessThan(long.length);
  });

  it("compacts git diffs", () => {
    const hunkLines = Array.from({ length: 120 }, (_, i) => `+added line ${i} with enough text`).join("\n");
    const diff = `diff --git a/longfile b/longfile\n@@ -1,1 +1,120 @@\n${hunkLines}`;
    const body = { messages: [{ role: "tool", content: diff }] };
    const { body: out, savedChars } = compressToolResults(body);
    expect(savedChars).toBeGreaterThan(0);
    expect(out.messages[0].content).toMatch(/truncated|longfile/);
    expect(out.messages[0].content.length).toBeLessThan(diff.length);
  });

  it("never enlarges output", () => {
    const diff = "diff --git a/f b/f\n@@ -1,3 +1,3 @@\n a\n b\n c\n+x";
    const body = { messages: [{ role: "tool", content: diff }] };
    const { savedChars } = compressToolResults(body);
    expect(savedChars).toBe(0);
  });

  it("preserves tool_result error blocks", () => {
    const long = Array.from({ length: 300 }, (_, i) => `error line ${i}`).join("\n");
    const body = {
      messages: [
        {
          role: "user",
          content: [{ type: "tool_result", is_error: true, content: long }]
        }
      ]
    };
    const { savedChars } = compressToolResults(body);
    expect(savedChars).toBe(0);
  });

  it("compresses Claude-style tool_result text", () => {
    const long = Array.from({ length: 300 }, (_, i) => `npm warn deprecated package-${i}`).join("\n") + "\nnpm error code ERESOLVE";
    const body = {
      messages: [
        {
          role: "user",
          content: [{ type: "tool_result", content: long }]
        }
      ]
    };
    const { savedChars, body: out } = compressToolResults(body);
    expect(savedChars).toBeGreaterThan(0);
    expect(out.messages[0].content[0].content.length).toBeLessThan(long.length);
  });
});
