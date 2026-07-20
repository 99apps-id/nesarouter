import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleExecutor } from "@/core/providers/openaiCompatible";
import { ProviderConfig } from "@/core/types";

const provider: ProviderConfig = {
  id: "openrouter-free",
  name: "OpenRouter Free",
  type: "openai_compatible",
  tier: "free",
  status: "active",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: "or-key",
  model: "openrouter/free",
  priority: 10,
  inputCostPerMTok: 0,
  outputCostPerMTok: 0
};

describe("OpenRouter validation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requires both model discovery and inference to succeed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "openrouter/free" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new OpenAiCompatibleExecutor().validate(provider);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.message).toMatch(/inference accepted/i);
  });

  it("does not report connected when inference is rejected", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "openrouter/free" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "unauthorized" } }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new OpenAiCompatibleExecutor().validate(provider)).rejects.toMatchObject({ status: 401 });
  });
});
