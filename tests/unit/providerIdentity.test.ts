import fs from "node:fs";
import path from "node:path";
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
    expect(providerIdentity({ id: "zhipu-glm", name: "zhipu-glm" }).iconPath).toBe("/providers/zhipu.png");
    expect(providerIdentity({ id: "openrouter", name: "OpenRouter" }).iconPath).toBe("/providers/openrouter.png");
  });

  it("keeps KIMI and Moonshot visually distinct", () => {
    expect(providerIdentity({ id: "kimi-coding", name: "Kimi Coding" }).iconPath).toBe("/providers/kimi.png");
    expect(providerIdentity({ id: "moonshot", name: "Moonshot" }).iconPath).toBe("/providers/moonshot.png");
  });

  it("uses official brand PNG marks for major providers", () => {
    expect(providerIdentity({ id: "openrouter", name: "OpenRouter" }).iconPath).toBe("/providers/openrouter.png");
    expect(providerIdentity({ id: "runware", name: "Runware" }).iconPath).toBe("/providers/runware.svg");
    expect(providerIdentity({ id: "cerebras", name: "Cerebras" }).iconPath).toBe("/providers/cerebras.svg");
  });

  it("resolves the newer catalog brands to bundled icon files", () => {
    for (const id of ["huggingface", "perplexity", "replicate", "cohere", "fireworks", "fal-ai", "hyperbolic", "nebius", "chutes"]) {
      const identity = providerIdentity({ id, name: id });
      expect(identity.iconPath).toBeTruthy();
      expect(fs.existsSync(path.join(process.cwd(), "public", identity.iconPath!))).toBe(true);
    }
    expect(providerIdentity({ id: "meta-llama", name: "meta-llama" }).key).toBe("meta");
    expect(providerIdentity({ id: "stepfun-intl", name: "stepfun-intl" }).key).toBe("stepfun");
  });
});
