import { describe, expect, it } from "vitest";
import { compressToolResults } from "@/core/rtk";

const pastedDiff = [
  "diff --git a/big.ts b/big.ts",
  "@@ -1,1 +1,200 @@",
  ...Array.from({ length: 200 }, (_, i) => `+pasted line ${i} with enough text to matter`)
].join("\n");

function compress(body: any) {
  const result = compressToolResults(body);
  return { out: result.body as any, savedChars: result.savedChars };
}

describe("rtk scope", () => {
  it("does not rewrite plain user text blocks", () => {
    const body = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: pastedDiff },
            { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }
          ]
        }
      ]
    };

    const { out, savedChars } = compress(body);
    expect(savedChars).toBe(0);
    expect(out.messages[0].content[0].text).toBe(pastedDiff);
  });

  it("does not rewrite plain assistant text blocks", () => {
    const body = {
      messages: [{ role: "assistant", content: [{ type: "text", text: pastedDiff }] }]
    };

    const { out, savedChars } = compress(body);
    expect(savedChars).toBe(0);
    expect(out.messages[0].content[0].text).toBe(pastedDiff);
  });

  it("still compresses Claude tool_result blocks inside a user message", () => {
    const body = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "here is the log" },
            { type: "tool_result", content: pastedDiff }
          ]
        }
      ]
    };

    const { out, savedChars } = compress(body);
    expect(savedChars).toBeGreaterThan(0);
    expect(out.messages[0].content[0].text).toBe("here is the log");
    expect(String(out.messages[0].content[1].content).length).toBeLessThan(pastedDiff.length);
  });

  it("still compresses string-content tool messages", () => {
    const body = { messages: [{ role: "tool", content: pastedDiff }] };

    const { out, savedChars } = compress(body);
    expect(savedChars).toBeGreaterThan(0);
    expect(String(out.messages[0].content).length).toBeLessThan(pastedDiff.length);
  });
});
