import { describe, expect, it } from "vitest";
import { appendCodexReviewModels } from "@/core/providers/openaiResponses";

describe("codex model catalog", () => {
  it("appends review aliases for primary codex models", () => {
    expect(appendCodexReviewModels(["gpt-5.6-sol", "gpt-5.6-terra-review"])).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-sol-review",
      "gpt-5.6-terra-review"
    ]);
  });
});
