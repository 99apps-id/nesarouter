import { ProviderConfig } from "@/core/types";

export interface ProviderIdentityInput {
  id?: string;
  name?: string;
  baseUrl?: string;
  model?: string;
  providerName?: string;
}

export interface ProviderIdentity {
  key: string;
  label: string;
  title: string;
  iconPath?: string;
}

function has(value: string, pattern: RegExp) {
  return pattern.test(value.toLowerCase());
}

function initials(value: string) {
  return value
    .split(/[\s/._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AI";
}

export function providerIdentity(input: ProviderIdentityInput | ProviderConfig): ProviderIdentity {
  const providerName = "providerName" in input ? input.providerName : undefined;
  const providerText = `${input.id ?? ""} ${input.name ?? ""} ${providerName ?? ""} ${input.baseUrl ?? ""}`;
  const text = `${providerText} ${input.model ?? ""}`;
  const title = input.name ?? providerName ?? input.id ?? "Provider";

  // Prefer the configured provider brand over a model hosted by that provider.
  // If no provider is recognised, the model name below still gives usage rows a useful icon.
  if (has(providerText, /dashscope|alibaba/)) return { key: "qwen", label: "Q", title, iconPath: "/providers/qwen.png" };
  if (has(providerText, /xiaomi/)) return { key: "xiaomi", label: "MI", title, iconPath: "/providers/xiaomi.svg" };
  if (has(providerText, /moonshot/)) return { key: "moonshot", label: "MS", title, iconPath: "/providers/moonshot.svg" };
  if (has(providerText, /kimi/)) return { key: "kimi", label: "K", title, iconPath: "/providers/kimi.svg" };
  if (has(providerText, /zhipu|bigmodel/)) return { key: "zhipu", label: "Z", title };
  if (has(providerText, /minimax/)) return { key: "minimax", label: "MM", title, iconPath: "/providers/minimax.svg" };
  if (has(providerText, /volcengine|doubao/)) return { key: "volcengine", label: "DB", title };
  if (has(providerText, /siliconflow/)) return { key: "siliconflow", label: "SF", title };
  if (has(providerText, /baidu|qianfan/)) return { key: "baidu", label: "BD", title, iconPath: "/providers/baidu.svg" };
  if (has(providerText, /stepfun/)) return { key: "stepfun", label: "ST", title };
  if (has(providerText, /together/)) return { key: "together", label: "TO", title, iconPath: "/providers/together.svg" };
  if (has(providerText, /runware/)) return { key: "runware", label: "RW", title, iconPath: "/providers/runware.svg" };
  if (has(providerText, /fireworks/)) return { key: "fireworks", label: "FW", title };
  if (has(providerText, /cerebras/)) return { key: "cerebras", label: "CB", title, iconPath: "/providers/cerebras.svg" };
  if (has(providerText, /xai|grok/)) return { key: "xai", label: "X", title, iconPath: "/providers/xai.svg" };

  if (has(text, /openrouter/)) return { key: "openrouter", label: "OR", title, iconPath: "/providers/openrouter.png" };
  if (has(text, /deepseek/)) return { key: "deepseek", label: "DS", title, iconPath: "/providers/deepseek.png" };
  if (has(text, /gemini|google|generativelanguage/)) return { key: "gemini", label: "G", title, iconPath: "/providers/gemini.png" };
  if (has(text, /openai|gpt-4|gpt-5/)) return { key: "openai", label: "AI", title, iconPath: "/providers/openai.png" };
  if (has(text, /mistral/)) return { key: "mistral", label: "M", title, iconPath: "/providers/mistral.png" };
  if (has(text, /groq/)) return { key: "groq", label: "GQ", title, iconPath: "/providers/groq.png" };
  if (has(text, /ollama|localhost:11434/)) return { key: "ollama", label: "OL", title, iconPath: "/providers/ollama.png" };
  if (has(text, /anthropic/)) return { key: "anthropic", label: "A", title, iconPath: "/providers/anthropic.png" };
  if (has(text, /claude/)) return { key: "claude", label: "C", title, iconPath: "/providers/claude.png" };
  if (has(text, /qwen|dashscope/)) return { key: "qwen", label: "Q", title, iconPath: "/providers/qwen.png" };
  if (has(text, /github|copilot/)) return { key: "github", label: "GH", title, iconPath: "/providers/github.png" };
  if (has(text, /codex/)) return { key: "codex", label: "CX", title, iconPath: "/providers/codex.png" };
  if (has(text, /cursor/)) return { key: "cursor", label: "CU", title, iconPath: "/providers/cursor.png" };
  if (has(text, /kiro/)) return { key: "kiro", label: "K", title, iconPath: "/providers/kiro.png" };
  if (has(text, /antigravity/)) return { key: "antigravity", label: "AG", title, iconPath: "/providers/antigravity.png" };
  if (has(text, /opencode/)) return { key: "opencode", label: "OC", title, iconPath: "/providers/opencode.png" };
  if (has(text, /mimo/)) return { key: "mimo-free", label: "MI", title, iconPath: "/providers/mimo-free.png" };
  if (has(text, /nvidia|nim/)) return { key: "nvidia", label: "NV", title, iconPath: "/providers/nvidia.png" };
  if (has(text, /dashscope|alibaba|qwen/)) return { key: "qwen", label: "Q", title, iconPath: "/providers/qwen.png" };
  if (has(text, /moonshot/)) return { key: "moonshot", label: "MS", title, iconPath: "/providers/moonshot.svg" };
  if (has(text, /kimi/)) return { key: "kimi", label: "K", title, iconPath: "/providers/kimi.svg" };
  if (has(text, /minimax/)) return { key: "minimax", label: "MM", title, iconPath: "/providers/minimax.svg" };
  if (has(text, /baidu|qianfan|ernie/)) return { key: "baidu", label: "BD", title, iconPath: "/providers/baidu.svg" };
  if (has(text, /xai|grok/)) return { key: "xai", label: "X", title, iconPath: "/providers/xai.svg" };
  if (has(text, /xiaomi/)) return { key: "xiaomi", label: "MI", title, iconPath: "/providers/xiaomi.svg" };
  if (has(text, /zhipu|bigmodel|\bglm\b/)) return { key: "zhipu", label: "Z", title };
  if (has(text, /volcengine|doubao/)) return { key: "volcengine", label: "DB", title };
  if (has(text, /siliconflow/)) return { key: "siliconflow", label: "SF", title };
  if (has(text, /stepfun|step[- ]/)) return { key: "stepfun", label: "ST", title };
  if (has(text, /together/)) return { key: "together", label: "TO", title };
  if (has(text, /runware/)) return { key: "runware", label: "RW", title };
  if (has(text, /fireworks/)) return { key: "fireworks", label: "FW", title };
  if (has(text, /cerebras/)) return { key: "cerebras", label: "CB", title };

  return { key: "custom", label: initials(title), title };
}
