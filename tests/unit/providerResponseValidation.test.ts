import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "@/core/types";
import { upstreamJson } from "@/core/providers/shared";

const provider = {
  id: "mock",
  name: "Mock upstream",
  type: "openai_compatible"
} as ProviderConfig;

describe("provider response validation", () => {
  it("returns an object payload", async () => {
    await expect(upstreamJson(provider, new Response('{"ok":true}'))).resolves.toEqual({ ok: true });
  });

  it("maps malformed JSON to a structured upstream error", async () => {
    await expect(upstreamJson(provider, new Response("not-json"), "chat completion")).rejects.toMatchObject({
      status: 502,
      providerCode: "malformed_json",
      providerType: "openai_compatible"
    });
  });

  it("rejects scalar JSON payloads", async () => {
    await expect(upstreamJson(provider, new Response("null"))).rejects.toMatchObject({
      status: 502,
      providerCode: "invalid_payload"
    });
  });
});
