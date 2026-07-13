import { describe, it, expect } from "vitest";
import { detectTaskType, estimateCost, estimateOutputTokens, estimateTokens, extractRequestText } from "@/core/estimation";

describe("estimation", () => {
  it("estimates tokens by char length", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });

  it("detects task types by keywords", () => {
    expect(detectTaskType("refactor besar arsitektur microservice")).toBe("coding_heavy");
    expect(detectTaskType("analisis dokumen panjang dan ringkas")).toBe("analysis");
    expect(detectTaskType("tulis function typescript untuk api route")).toBe("coding_light");
    expect(detectTaskType("halo")).toBe("chat");
  });

  it("estimates output tokens with a sane floor", () => {
    expect(estimateOutputTokens(10, "chat")).toBeGreaterThanOrEqual(128);
    expect(estimateOutputTokens(1000, "coding_heavy")).toBeGreaterThan(estimateOutputTokens(1000, "chat"));
  });

  it("computes cost from per-million pricing", () => {
    expect(estimateCost(1_000_000, 0, 1, 0)).toBe(1);
    expect(estimateCost(0, 1_000_000, 0, 2)).toBe(2);
  });

  it("extracts text from messages and input", () => {
    expect(extractRequestText({ messages: [{ role: "user", content: "hi" }], input: "extra" })).toBe("hi extra");
    expect(extractRequestText({ messages: [{ role: "user", content: [{ text: "a" }, { text: "b" }] }] })).toBe("a b");
  });
});
