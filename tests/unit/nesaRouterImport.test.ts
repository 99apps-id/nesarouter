import { describe, expect, it } from "vitest";
import { mergeNesaRouterAliases, normalizeNesaRouterTarget } from "@/core/nesaRouterImport";

describe("normalizeNesaRouterTarget", () => {
  it("rewrites single-colon provider:model to slash form", () => {
    expect(normalizeNesaRouterTarget("or:meta-llama/llama")).toBe("or:meta-llama/llama");
    expect(normalizeNesaRouterTarget("openai:gpt-4o")).toBe("openai/gpt-4o");
    expect(normalizeNesaRouterTarget("  cc:claude-sonnet  ")).toBe("cc/claude-sonnet");
  });

  it("leaves slashes, URLs, and multi-colon strings alone", () => {
    expect(normalizeNesaRouterTarget("or/meta-llama/llama")).toBe("or/meta-llama/llama");
    expect(normalizeNesaRouterTarget("https://example.com/m")).toBe("https://example.com/m");
    expect(normalizeNesaRouterTarget("a:b:c")).toBe("a:b:c");
  });
});

describe("mergeNesaRouterAliases", () => {
  it("imports NesaRouter { aliases: map } shape", () => {
    const result = mergeNesaRouterAliases([], {
      aliases: { fast: "or/meta-llama/llama", smart: "cx/gpt-5.5" }
    });
    expect(result.added).toBe(2);
    expect(result.aliases).toEqual([
      { id: "fast", alias: "fast", target: "or/meta-llama/llama" },
      { id: "smart", alias: "smart", target: "cx/gpt-5.5" }
    ]);
  });

  it("imports flat maps and Nesa arrays", () => {
    const fromFlat = mergeNesaRouterAliases([], { cheap: "ollama/llama3" });
    expect(fromFlat.added).toBe(1);
    expect(fromFlat.aliases[0]?.target).toBe("ollama/llama3");

    const fromArray = mergeNesaRouterAliases([], {
      aliases: [{ alias: "fast", target: "openai:gpt-4o" }]
    });
    expect(fromArray.aliases[0]?.target).toBe("openai/gpt-4o");
  });

  it("merges case-insensitively and overwrites targets", () => {
    const existing = [{ id: "fast", alias: "Fast", target: "old-model" }];
    const result = mergeNesaRouterAliases(existing, { aliases: { fast: "new-model" } });
    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
    expect(result.aliases).toHaveLength(1);
    expect(result.aliases[0]).toEqual({ id: "fast", alias: "fast", target: "new-model" });
  });

  it("skips no-op duplicates", () => {
    const existing = [{ id: "fast", alias: "fast", target: "same" }];
    const result = mergeNesaRouterAliases(existing, { aliases: { fast: "same" } });
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
  });
});
