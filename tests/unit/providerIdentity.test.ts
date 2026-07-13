import { describe, expect, it } from "vitest";
import { providerIdentity } from "@/lib/providerIdentity";

describe("provider identity", () => {
  it("prefers a configured provider brand over the hosted model", () => {
    expect(providerIdentity({ id: "runware", name: "Runware", model: "minimax:m3@0" }).key).toBe("runware");
    expect(providerIdentity({ id: "volcengine-ark", name: "Volcengine Ark", model: "DeepSeek-V4-Flash" }).key).toBe("volcengine");
  });

  it("covers the extended provider catalog with a visual identity", () => {
    for (const id of ["alibaba-coding", "moonshot", "zhipu-glm", "minimax", "baidu-qianfan", "stepfun-intl", "together", "fireworks", "cerebras", "xai-grok"]) {
      expect(providerIdentity({ id, name: id }).key).not.toBe("custom");
    }
  });

  it("keeps KIMI and Moonshot visually distinct", () => {
    expect(providerIdentity({ id: "kimi-coding", name: "Kimi Coding" }).iconPath).toBe("/providers/kimi.svg");
    expect(providerIdentity({ id: "moonshot", name: "Moonshot" }).iconPath).toBe("/providers/moonshot.svg");
  });

  it("uses local SVG marks for Runware and Cerebras", () => {
    expect(providerIdentity({ id: "runware", name: "Runware" }).iconPath).toBe("/providers/runware.svg");
    expect(providerIdentity({ id: "cerebras", name: "Cerebras" }).iconPath).toBe("/providers/cerebras.svg");
  });
});
