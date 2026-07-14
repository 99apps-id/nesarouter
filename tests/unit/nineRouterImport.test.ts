import { describe, expect, it } from "vitest";
import { mergeNineRouterAliases, normalizeNineRouterTarget } from "@/core/nineRouterImport";

describe("normalizeNineRouterTarget", () => {
  it("rewrites single-colon provider:model to slash form", () => {
    expect(normalizeNineRouterTarget("or:meta-llama/llama")).toBe("or:meta-llama/llama");
    expect(normalizeNineRouterTarget("openai:gpt-4o")).toBe("openai/gpt-4o");
    expect(normalizeNineRouterTarget("  cc:claude-sonnet  ")).toBe("cc/claude-sonnet");
  });

  it("leaves slashes, URLs, and multi-colon strings alone", () => {
    expect(normalizeNineRouterTarget("or/meta-llama/llama")).toBe("or/meta-llama/llama");
    expect(normalizeNineRouterTarget("https://example.com/m")).toBe("https://example.com/m");
    expect(normalizeNineRouterTarget("a:b:c")).toBe("a:b:c");
  });
});

describe("mergeNineRouterAliases", () => {
  it("imports 9router { aliases: map } shape", () => {
    const result = mergeNineRouterAliases([], {
      aliases: { fast: "or/meta-llama/llama", smart: "cx/gpt-5.5" }
    });
    expect(result.added).toBe(2);
    expect(result.aliases).toEqual([
      { id: "fast", alias: "fast", target: "or/meta-llama/llama" },
      { id: "smart", alias: "smart", target: "cx/gpt-5.5" }
    ]);
  });

  it("imports flat maps and Nesa arrays", () => {
    const fromFlat = mergeNineRouterAliases([], { cheap: "ollama/llama3" });
    expect(fromFlat.added).toBe(1);
    expect(fromFlat.aliases[0]?.target).toBe("ollama/llama3");

    const fromArray = mergeNineRouterAliases([], {
      aliases: [{ alias: "fast", target: "openai:gpt-4o" }]
    });
    expect(fromArray.aliases[0]?.target).toBe("openai/gpt-4o");
  });

  it("merges case-insensitively and overwrites targets", () => {
    const existing = [{ id: "fast", alias: "Fast", target: "old-model" }];
    const result = mergeNineRouterAliases(existing, { aliases: { fast: "new-model" } });
    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
    expect(result.aliases).toHaveLength(1);
    expect(result.aliases[0]).toEqual({ id: "fast", alias: "fast", target: "new-model" });
  });

  it("skips no-op duplicates", () => {
    const existing = [{ id: "fast", alias: "fast", target: "same" }];
    const result = mergeNineRouterAliases(existing, { aliases: { fast: "same" } });
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
  });
});
