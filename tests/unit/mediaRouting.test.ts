import { describe, expect, it } from "vitest";
import { chooseMediaProvider } from "@/core/mediaRouting";
import { defaultStore } from "@/lib/defaults";
import { ProviderConfig } from "@/core/types";

const openAiProvider: ProviderConfig = {
  id: "openai-main",
  name: "OpenAI",
  type: "openai_compatible",
  status: "active",
  tier: "premium",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "sk-test",
  priority: 1,
  inputCostPerMTok: 0.15,
  outputCostPerMTok: 0.6
};

describe("media routing", () => {
  it("pins media requests to a configured provider", () => {
    const store = {
      ...defaultStore,
      providers: [openAiProvider],
      router: {
        ...defaultStore.router,
        mediaRouting: { imagesProviderId: "openai-main" }
      }
    };

    const decision = chooseMediaProvider(store, "images", { model: "auto", probeText: "draw a cat" });
    expect(decision.provider.id).toBe("openai-main");
    expect(decision.routingReason).toContain("pinned");
  });

  it("falls back to the main router when no override is set", () => {
    const store = {
      ...defaultStore,
      providers: [openAiProvider]
    };

    const decision = chooseMediaProvider(store, "speech", { model: "auto", probeText: "hello" });
    expect(decision.provider.id).toBe("openai-main");
  });

  it("skips providers that do not speak the OpenAI media API instead of failing", () => {
    const geminiProvider: ProviderConfig = {
      id: "gemini-flash",
      name: "Gemini Flash",
      type: "gemini",
      status: "active",
      tier: "free",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.0-flash",
      apiKey: "gemini-test",
      priority: 1,
      inputCostPerMTok: 0,
      outputCostPerMTok: 0
    };
    const store = {
      ...defaultStore,
      providers: [geminiProvider, openAiProvider],
      router: { ...defaultStore.router, mediaRouting: { searchMode: "builtin" as const } }
    };

    // Free tier ranks first, but /v1/images/generations can only call the OpenAI
    // adapter — the router must keep walking instead of returning a 400.
    const decision = chooseMediaProvider(store, "images", { model: "auto", probeText: "draw a cat" });
    expect(decision.provider.id).toBe("openai-main");
  });

  it("reports why media routing failed when no OpenAI-compatible provider is usable", () => {
    const geminiOnly: ProviderConfig = {
      id: "gemini-only",
      name: "Gemini only",
      type: "gemini",
      status: "active",
      tier: "free",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.0-flash",
      apiKey: "gemini-test",
      priority: 1,
      inputCostPerMTok: 0,
      outputCostPerMTok: 0
    };
    const store = {
      ...defaultStore,
      providers: [geminiOnly]
    };

    expect(() => chooseMediaProvider(store, "images", { model: "auto", probeText: "draw a cat" })).toThrow(
      /OpenAI-compatible/i
    );
  });
});
