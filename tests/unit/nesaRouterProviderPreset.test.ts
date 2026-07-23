import { describe, expect, it } from "vitest";
import { providerPresets, providerPresetGroups } from "@/lib/providerPresets";
import { providerGroup } from "@/lib/providerGroups";

describe("NesaRouter provider preset", () => {
  it("ships as a disabled OpenAI-compatible provider with the public v1 endpoint", () => {
    const provider = providerPresets.find((item) => item.id === "nesarouter");

    expect(provider).toMatchObject({
      name: "NesaRouter",
      type: "openai_compatible",
      tier: "balanced",
      status: "disabled",
      baseUrl: "https://nesarouter.com/v1",
      model: "nesarouter/nesa-free"
    });
    expect(provider && providerGroup(provider)).toBe("paid");
  });

  it("is selectable from the provider catalog", () => {
    const group = providerPresetGroups.find((item) => item.label === "Global API key");
    expect(group?.ids).toContain("nesarouter");
  });
});
