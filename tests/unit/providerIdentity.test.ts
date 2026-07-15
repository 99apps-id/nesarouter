import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { providerIdentity } from "@/lib/providerIdentity";

describe("provider identity", () => {
  it("prefers a configured provider brand over the hosted model", () => {
    expect(providerIdentity({ id: "runware", name: "Runware", model: "minimax:m3@0" }).key).toBe("runware");
    expect(providerIdentity({ id: "volcengine-ark", name: "Volcengine Ark", model: "DeepSeek-V4-Flash" }).key).toBe(
      "volcengine"
    );
  });

  it("covers the extended provider catalog with a visual identity", () => {
    for (const id of [
      "alibaba-coding",
      "moonshot",
      "zhipu-glm",
      "minimax",
      "baidu-qianfan",
      "stepfun-intl",
      "together",
      "fireworks",
      "cerebras",
      "xai-grok"
    ]) {
      expect(providerIdentity({ id, name: id }).key).not.toBe("custom");
    }
    expect(providerIdentity({ id: "zhipu-glm", name: "zhipu-glm" }).iconPath).toBe("/providers/zhipu.png");
    expect(providerIdentity({ id: "openrouter", name: "OpenRouter" }).iconPath).toBe("/providers/openrouter.png");
  });

  it("keeps KIMI and Moonshot visually distinct", () => {
    const kimi = providerIdentity({ id: "kimi-coding", name: "Kimi Coding" });
    const moonshot = providerIdentity({ id: "moonshot", name: "Moonshot" });
    expect(kimi.iconPath).toBe("/providers/kimi.png");
    expect(moonshot.iconPath).toBe("/providers/moonshot.png");
    expect(kimi.iconPath).not.toBe(moonshot.iconPath);
    expect(fs.readFileSync(path.join(process.cwd(), "public", kimi.iconPath!))).not.toEqual(
      fs.readFileSync(path.join(process.cwd(), "public", moonshot.iconPath!))
    );
  });

  it("keeps Hyperbolic distinct from OpenRouter", () => {
    const hyperbolic = providerIdentity({ id: "hyperbolic", name: "Hyperbolic" });
    const openrouter = providerIdentity({ id: "openrouter", name: "OpenRouter" });
    expect(hyperbolic.iconPath).toBe("/providers/hyperbolic.png");
    expect(openrouter.iconPath).toBe("/providers/openrouter.png");
    expect(fs.readFileSync(path.join(process.cwd(), "public", hyperbolic.iconPath!))).not.toEqual(
      fs.readFileSync(path.join(process.cwd(), "public", openrouter.iconPath!))
    );
  });

  it("separates sibling brand variants", () => {
    expect(providerIdentity({ id: "alibaba-coding", name: "Alibaba Coding" }).iconPath).toBe(
      "/providers/alibaba-cloud.png"
    );
    expect(providerIdentity({ id: "alibaba-dashscope", name: "Alibaba DashScope (Qwen)" }).iconPath).toBe(
      "/providers/qwen.png"
    );
    expect(providerIdentity({ id: "oauth-github-copilot", name: "GitHub Copilot" }).iconPath).toBe(
      "/providers/copilot.svg"
    );
    expect(providerIdentity({ id: "github-models", name: "GitHub Models" }).iconPath).toBe("/providers/github.png");
    expect(providerIdentity({ id: "oauth-gemini-cli", name: "Gemini CLI" }).iconPath).toBe("/providers/gemini-cli.png");
    expect(providerIdentity({ id: "gemini-flash", name: "Gemini API" }).iconPath).toBe("/providers/gemini.png");
    expect(providerIdentity({ id: "opencode-go", name: "OpenCode Go" }).iconPath).toBe("/providers/opencode-go.svg");
    expect(providerIdentity({ id: "opencode-free", name: "OpenCode Free" }).iconPath).toBe("/providers/opencode.png");
    expect(providerIdentity({ id: "cloudflare-workers-ai", name: "Cloudflare Workers AI" }).iconPath).toBe(
      "/providers/cloudflare.svg"
    );
    expect(providerIdentity({ id: "azure-openai", name: "Azure OpenAI" }).iconPath).toBe("/providers/azure.png");
    expect(providerIdentity({ id: "blackbox", name: "Blackbox AI" }).iconPath).toBe("/providers/blackbox.png");
    expect(providerIdentity({ id: "iflow", name: "iFlow AI" }).iconPath).toBe("/providers/iflow.png");
    expect(providerIdentity({ id: "kilocode", name: "Kilo Code" }).iconPath).toBe("/providers/kilocode.png");
    expect(providerIdentity({ id: "cline", name: "Cline" }).iconPath).toBe("/providers/cline.png");
    expect(providerIdentity({ id: "clinepass", name: "ClinePass" }).iconPath).toBe("/providers/clinepass.png");
    expect(providerIdentity({ id: "codebuddy-cn", name: "CodeBuddy CN" }).iconPath).toBe("/providers/codebuddy-cn.png");
    expect(providerIdentity({ id: "gitlab-duo", name: "GitLab Duo" }).iconPath).toBe("/providers/gitlab.svg");
    expect(providerIdentity({ id: "xiaomi-tokenplan", name: "Xiaomi Token Plan" }).iconPath).toBe(
      "/providers/xiaomi-tokenplan.svg"
    );
    expect(providerIdentity({ id: "xiaomi-mimo", name: "Xiaomi MiMo" }).iconPath).toBe("/providers/xiaomi.png");
  });

  it("uses official brand PNG marks for major providers", () => {
    expect(providerIdentity({ id: "openrouter", name: "OpenRouter" }).iconPath).toBe("/providers/openrouter.png");
    expect(providerIdentity({ id: "runware", name: "Runware" }).iconPath).toBe("/providers/runware.svg");
    expect(providerIdentity({ id: "cerebras", name: "Cerebras" }).iconPath).toBe("/providers/cerebras.svg");
  });

  it("resolves the newer catalog brands to bundled icon files", () => {
    for (const id of [
      "huggingface",
      "perplexity",
      "replicate",
      "cohere",
      "fireworks",
      "fal-ai",
      "hyperbolic",
      "nebius",
      "chutes"
    ]) {
      const identity = providerIdentity({ id, name: id });
      expect(identity.iconPath).toBeTruthy();
      expect(fs.existsSync(path.join(process.cwd(), "public", identity.iconPath!))).toBe(true);
    }
    expect(providerIdentity({ id: "meta-llama", name: "meta-llama" }).key).toBe("meta");
    expect(providerIdentity({ id: "stepfun-intl", name: "stepfun-intl" }).key).toBe("stepfun");
  });
});
