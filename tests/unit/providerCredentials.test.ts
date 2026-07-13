import { describe, expect, it } from "vitest";
import { isKeylessProvider, providerHasCredential } from "@/core/providerCredentials";
import { pickActiveKeys } from "@/core/providerKeys";
import { ProviderConfig } from "@/core/types";

const opencodeFree: ProviderConfig = {
  id: "opencode-free",
  name: "OpenCode Free",
  type: "opencode",
  tier: "free",
  status: "active",
  baseUrl: "https://opencode.ai",
  apiKey: "",
  model: "auto",
  priority: 16,
  inputCostPerMTok: 0,
  outputCostPerMTok: 0
};

describe("keyless providers", () => {
  it("treats OpenCode Free as keyless", () => {
    expect(isKeylessProvider(opencodeFree)).toBe(true);
    expect(providerHasCredential(opencodeFree)).toBe(true);
    expect(pickActiveKeys(opencodeFree)).toEqual([{ key: "", index: 0 }]);
  });
});
