import { describe, expect, it, beforeEach } from "vitest";
import {
  clearStickySessionsForTests,
  isAgentContinuation,
  peekStickyProvider,
  rememberStickyProvider,
  stickySessionKey
} from "@/core/stickyRouting";
import { chooseProvider, findCombo } from "@/core/router";
import { defaultStore } from "@/lib/defaults";
import { NesaStore, ProviderConfig } from "@/core/types";

function provider(partial: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: partial.id ?? "p",
    name: partial.name ?? "P",
    type: "openai_compatible",
    tier: partial.tier ?? "free",
    status: "active",
    baseUrl: "http://example/v1",
    apiKey: "key",
    model: partial.model ?? "m",
    priority: partial.priority ?? 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    ...partial
  };
}

describe("stickyRouting", () => {
  beforeEach(() => clearStickySessionsForTests());

  it("detects tool-loop continuations", () => {
    expect(isAgentContinuation({ messages: [{ role: "user", content: "hi" }] })).toBe(false);
    expect(
      isAgentContinuation({
        messages: [
          { role: "user", content: "hi" },
          { role: "assistant", tool_calls: [{ id: "1", type: "function", function: { name: "x", arguments: "{}" } }] },
          { role: "tool", tool_call_id: "1", content: "ok" }
        ]
      })
    ).toBe(true);
    expect(isAgentContinuation({ previous_response_id: "resp_1" })).toBe(true);
  });

  it("namespaces explicit session ids by API credential", () => {
    const body = { model: "auto", messages: [{ role: "tool", content: "done" }] };
    const first = new Request("http://localhost/v1/chat/completions", {
      headers: { authorization: "Bearer client-one", "x-nesa-session": "shared" }
    });
    const second = new Request("http://localhost/v1/chat/completions", {
      headers: { authorization: "Bearer client-two", "x-nesa-session": "shared" }
    });

    expect(stickySessionKey(body, first)).not.toBe(stickySessionKey(body, second));
  });

  it("preserves fallback combo order even when a sticky provider is preferred", () => {
    const store: NesaStore = {
      ...defaultStore,
      providers: [
        provider({ id: "first", name: "First", priority: 1 }),
        provider({ id: "second", name: "Second", priority: 2 })
      ],
      usage: []
    };
    const combo = { id: "stable", name: "Stable", providerIds: ["first", "second"], strategy: "fallback" as const };

    const decision = chooseProvider(store, { model: "stable", messages: [] }, [], combo, {
      preferProviderId: "second"
    });
    expect(decision.provider.id).toBe("first");
    expect(decision.routingReason).not.toMatch(/Sticky session/i);
  });

  it("resolves an exact combo id before a legacy conflicting name", () => {
    const store: NesaStore = {
      ...defaultStore,
      combos: [
        { id: "legacy", name: "target", providerIds: ["first"], strategy: "fallback" },
        { id: "target", name: "Target by ID", providerIds: ["second"], strategy: "fallback" }
      ]
    };

    expect(findCombo(store, "target")?.id).toBe("target");
  });

  it("pins the sticky provider on agent follow-up turns", () => {
    const store: NesaStore = {
      ...defaultStore,
      providers: [
        provider({ id: "first", name: "First", model: "a", priority: 1, tier: "premium" }),
        provider({ id: "second", name: "Second", model: "b", priority: 2, tier: "premium" })
      ],
      router: { ...defaultStore.router, routingMode: "best", preferFreeTier: false },
      usage: []
    };

    const body1 = {
      model: "auto",
      messages: [{ role: "user", content: "refactor the auth module" }]
    };
    const first = chooseProvider(store, body1);
    expect(first.provider.id).toBe("first");
    const key = stickySessionKey({
      model: "auto",
      messages: [
        { role: "user", content: "refactor the auth module" },
        { role: "assistant", tool_calls: [{ id: "t1", type: "function", function: { name: "read", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "t1", content: "file" }
      ]
    });
    expect(key).toBeTruthy();
    rememberStickyProvider(key, "second");
    expect(peekStickyProvider(key)).toBe("second");

    const body2 = {
      model: "auto",
      messages: [
        { role: "user", content: "refactor the auth module" },
        { role: "assistant", tool_calls: [{ id: "t1", type: "function", function: { name: "read", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "t1", content: "file" }
      ]
    };
    const sticky = chooseProvider(store, body2, [], undefined, { preferProviderId: peekStickyProvider(key)! });
    expect(sticky.provider.id).toBe("second");
    expect(sticky.routingReason).toMatch(/Sticky session/i);
  });

  it("keeps sticky key for tool-only follow-ups without user text", () => {
    const key = stickySessionKey({
      model: "auto",
      messages: [
        { role: "assistant", tool_calls: [{ id: "call_sticky", type: "function", function: { name: "read", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "call_sticky", content: "ok" }
      ]
    });
    expect(key).toBeTruthy();
    rememberStickyProvider(key, "second");
    expect(peekStickyProvider(key)).toBe("second");
  });
});
