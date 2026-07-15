import { describe, expect, it } from "vitest";
import { unwrapGeminiPayload, fromGeminiResponse } from "@/core/providers/gemini";
import { extractChatgptAccountId, appendCodexReviewModels } from "@/core/providers/openaiResponses";
import { resolveOpenCodeModel, zenSurfaceForModel } from "@/core/providers/opencode";

describe("Cloud Code gemini unwrap", () => {
  it("unwraps nested response payloads", () => {
    const nested = {
      response: {
        candidates: [{ content: { parts: [{ text: "hello" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
      }
    };
    expect(unwrapGeminiPayload(nested).candidates[0].content.parts[0].text).toBe("hello");
    const flat = { candidates: [{ content: { parts: [{ text: "x" }] } }] };
    expect(unwrapGeminiPayload(flat)).toBe(flat);
  });

  it("maps wrapped Cloud Code JSON into OpenAI chat completion", () => {
    const out = fromGeminiResponse(
      { model: "gemini-3-flash" } as any,
      {
        response: {
          candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1, totalTokenCount: 4 }
        }
      }
    );
    expect(out.choices[0].message.content).toBe("ok");
    expect(out.usage.total_tokens).toBe(4);
  });
});

describe("Codex account id", () => {
  it("reads chatgpt_account_id from JWT auth claim", () => {
    const payload = Buffer.from(
      JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acc-123" } })
    ).toString("base64url");
    expect(extractChatgptAccountId(`hdr.${payload}.sig`)).toBe("acc-123");
    expect(extractChatgptAccountId("not-jwt")).toBeUndefined();
  });

  it("appends review aliases", () => {
    expect(appendCodexReviewModels(["gpt-5.4"])).toEqual(["gpt-5.4", "gpt-5.4-review"]);
  });
});

describe("OpenCode model routing", () => {
  it("maps auto to big-pickle", () => {
    expect(resolveOpenCodeModel("auto")).toBe("big-pickle");
    expect(resolveOpenCodeModel("")).toBe("big-pickle");
    expect(resolveOpenCodeModel("deepseek-v4-flash-free")).toBe("deepseek-v4-flash-free");
  });

  it("picks zen surface by family", () => {
    expect(zenSurfaceForModel("big-pickle")).toBe("chat");
    expect(zenSurfaceForModel("claude-sonnet-5")).toBe("messages");
    expect(zenSurfaceForModel("gpt-5.4")).toBe("responses");
    expect(zenSurfaceForModel("qwen3.7-plus")).toBe("messages");
    expect(zenSurfaceForModel("gemini-3-flash")).toBe("gemini");
    expect(
      zenSurfaceForModel("minimax-m2.7", { id: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1" } as any)
    ).toBe("messages");
  });
});
