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
  // More specific variants first so sibling brands do not share one mark.

  if (
    has(providerText, /nesa.?router|router\.kliimora\.id|nesarouter\.com/) ||
    has(text, /(?:^|\s)nesarouter\//)
  ) {
    return { key: "nesarouter", label: "N", title, iconPath: "/icons/nesarouter.svg" };
  }

  if (has(providerText, /alibaba-coding|bailian|alicode/)) {
    return { key: "alibaba", label: "AB", title, iconPath: "/icons/alibaba-cloud.png" };
  }
  if (has(providerText, /dashscope|\bqwen\b|alibaba/)) {
    return { key: "qwen", label: "Q", title, iconPath: "/icons/qwen.png" };
  }

  if (has(providerText, /tokenplan|xmtp/)) {
    return { key: "xiaomi-tokenplan", label: "TP", title, iconPath: "/icons/xiaomi-tokenplan.svg" };
  }
  if (has(providerText, /mimo-code-free|mimo-free|mimo code free/)) {
    return { key: "mimo-free", label: "MF", title, iconPath: "/icons/mimo-free.png" };
  }
  if (has(providerText, /xiaomi|\bmimo\b/)) {
    return { key: "xiaomi", label: "MI", title, iconPath: "/icons/xiaomi.png" };
  }

  if (has(providerText, /kimi/)) {
    return { key: "kimi", label: "K", title, iconPath: "/icons/kimi.png" };
  }
  if (has(providerText, /moonshot/)) {
    return { key: "moonshot", label: "MS", title, iconPath: "/icons/moonshot.png" };
  }

  if (has(providerText, /zhipu|bigmodel|\bglm\b/)) {
    return { key: "zhipu", label: "Z", title, iconPath: "/icons/zhipu.png" };
  }
  if (has(providerText, /minimax-cn|minimaxi\.com/)) {
    return { key: "minimax-cn", label: "MM", title, iconPath: "/icons/minimax-cn.png" };
  }
  if (has(providerText, /minimax/)) {
    return { key: "minimax", label: "MM", title, iconPath: "/icons/minimax.png" };
  }
  if (has(providerText, /byteplus/)) {
    return { key: "byteplus", label: "BP", title, iconPath: "/icons/byteplus.png" };
  }
  if (has(providerText, /volcengine|doubao/)) {
    return { key: "volcengine", label: "DB", title, iconPath: "/icons/volcengine.png" };
  }
  if (has(providerText, /siliconflow/)) {
    return { key: "siliconflow", label: "SF", title, iconPath: "/icons/siliconflow.png" };
  }
  if (has(providerText, /baidu|qianfan/)) {
    return { key: "baidu", label: "BD", title, iconPath: "/icons/baidu.svg" };
  }
  if (has(providerText, /stepfun/)) {
    return { key: "stepfun", label: "ST", title };
  }
  if (has(providerText, /together/)) {
    return { key: "together", label: "TO", title, iconPath: "/icons/together.svg" };
  }
  if (has(providerText, /runware/)) {
    return { key: "runware", label: "RW", title, iconPath: "/icons/runware.svg" };
  }
  if (has(providerText, /fireworks/)) {
    return { key: "fireworks", label: "FW", title, iconPath: "/icons/fireworks.png" };
  }
  if (has(providerText, /cerebras/)) {
    return { key: "cerebras", label: "CB", title, iconPath: "/icons/cerebras.svg" };
  }
  if (has(providerText, /grok.?web|grok_web/)) {
    return { key: "grok-web", label: "GW", title, iconPath: "/icons/xai.png" };
  }
  if (has(providerText, /\bxai\b|grok/)) {
    return { key: "xai", label: "X", title, iconPath: "/icons/xai.png" };
  }
  if (has(providerText, /perplexity/)) {
    return { key: "perplexity", label: "PX", title, iconPath: "/icons/perplexity.png" };
  }
  if (has(providerText, /replicate/)) {
    return { key: "replicate", label: "RP", title, iconPath: "/icons/replicate.png" };
  }
  if (has(providerText, /fal\.ai|fal-ai|\bfal\b/)) {
    return { key: "fal", label: "F", title, iconPath: "/icons/fal-ai.png" };
  }
  if (has(providerText, /huggingface|hf\.co/)) {
    return { key: "huggingface", label: "HF", title, iconPath: "/icons/huggingface.png" };
  }
  if (has(providerText, /cohere/)) {
    return { key: "cohere", label: "CO", title, iconPath: "/icons/cohere.png" };
  }
  if (has(providerText, /hyperbolic/)) {
    return { key: "hyperbolic", label: "HB", title, iconPath: "/icons/hyperbolic.png" };
  }
  if (has(providerText, /nebius/)) {
    return { key: "nebius", label: "NB", title, iconPath: "/icons/nebius.png" };
  }
  if (has(providerText, /chutes/)) {
    return { key: "chutes", label: "CH", title, iconPath: "/icons/chutes.png" };
  }
  if (has(providerText, /meta\.ai|meta-llama|\bmeta\b/)) {
    return { key: "meta", label: "MA", title };
  }

  if (has(text, /openrouter/)) {
    return { key: "openrouter", label: "OR", title, iconPath: "/icons/openrouter.png" };
  }
  if (has(text, /deepseek/)) {
    return { key: "deepseek", label: "DS", title, iconPath: "/icons/deepseek.png" };
  }

  if (has(providerText, /gemini.?cli|oauth-gemini|gcli/)) {
    return { key: "gemini-cli", label: "GC", title, iconPath: "/icons/gemini-cli.png" };
  }
  if (has(text, /gemini|google|generativelanguage/)) {
    return { key: "gemini", label: "G", title, iconPath: "/icons/gemini.png" };
  }

  if (has(providerText, /copilot|oauth-github-copilot/)) {
    return { key: "github-copilot", label: "CP", title, iconPath: "/icons/copilot.svg" };
  }
  if (has(text, /github/)) {
    return { key: "github", label: "GH", title, iconPath: "/icons/github.png" };
  }

  // Codex / ChatGPT OAuth before generic OpenAI (avoids gpt-* model hijacking other brands).
  if (has(providerText, /codex|oauth-chatgpt|chatgpt/)) {
    return { key: "codex", label: "CX", title, iconPath: "/icons/codex.png" };
  }
  if (has(providerText, /azure/)) {
    return { key: "azure", label: "AZ", title, iconPath: "/icons/azure.png" };
  }
  if (has(providerText, /openai/) || has(text, /\bopenai\b/)) {
    return { key: "openai", label: "AI", title, iconPath: "/icons/openai.png" };
  }

  if (has(text, /mistral/)) {
    return { key: "mistral", label: "MT", title, iconPath: "/icons/mistral.png" };
  }
  if (has(text, /groq/)) {
    return { key: "groq", label: "GQ", title, iconPath: "/icons/groq.png" };
  }
  if (has(text, /ollama|localhost:11434/)) {
    return { key: "ollama", label: "OL", title, iconPath: "/icons/ollama.png" };
  }
  if (has(text, /anthropic/)) {
    return { key: "anthropic", label: "A", title, iconPath: "/icons/anthropic.png" };
  }
  if (has(text, /claude/)) {
    return { key: "claude", label: "C", title, iconPath: "/icons/claude.png" };
  }
  if (has(text, /cursor/)) {
    return { key: "cursor", label: "CU", title, iconPath: "/icons/cursor.png" };
  }
  if (has(text, /kiro/)) {
    return { key: "kiro", label: "KR", title, iconPath: "/icons/kiro.png" };
  }
  if (has(text, /antigravity/)) {
    return { key: "antigravity", label: "AG", title, iconPath: "/icons/antigravity.png" };
  }
  if (has(providerText, /opencode.?go|opencode-go/)) {
    return { key: "opencode-go", label: "OG", title, iconPath: "/icons/opencode-go.svg" };
  }
  if (has(text, /opencode/)) {
    return { key: "opencode", label: "OC", title, iconPath: "/icons/opencode.png" };
  }
  if (has(text, /nvidia|nim/)) {
    return { key: "nvidia", label: "NV", title, iconPath: "/icons/nvidia.png" };
  }
  if (has(text, /cloudflare|workers.?ai/)) {
    return { key: "cloudflare", label: "CF", title, iconPath: "/icons/cloudflare.svg" };
  }
  if (has(providerText, /vertex/)) {
    return { key: "vertex", label: "VX", title, iconPath: "/icons/vertex.png" };
  }
  if (has(providerText, /oauth-qwen|qwen.?code|portal\.qwen/)) {
    return { key: "qwen", label: "Q", title, iconPath: "/icons/qwen.png" };
  }
  if (has(providerText, /oauth-grok|grok.?cli|cli-chat-proxy\.grok/)) {
    return { key: "xai", label: "X", title, iconPath: "/icons/xai.png" };
  }
  if (has(providerText, /kimchi/)) {
    return { key: "kimchi", label: "KC", title, iconPath: "/icons/kimchi.png" };
  }
  if (has(providerText, /iflow/)) {
    return { key: "iflow", label: "IF", title, iconPath: "/icons/iflow.png" };
  }
  if (has(providerText, /codebuddy|copilot\.tencent/)) {
    return { key: "codebuddy", label: "CB", title, iconPath: "/icons/codebuddy-cn.png" };
  }
  if (has(providerText, /clinepass/)) {
    return { key: "clinepass", label: "CP", title, iconPath: "/icons/clinepass.png" };
  }
  if (has(providerText, /\bcline\b/)) {
    return { key: "cline", label: "CL", title, iconPath: "/icons/cline.png" };
  }
  if (has(providerText, /kilocode|kilo\.ai|\bkilo\b/)) {
    return { key: "kilocode", label: "KL", title, iconPath: "/icons/kilocode.png" };
  }
  if (has(providerText, /blackbox/)) {
    return { key: "blackbox", label: "BB", title, iconPath: "/icons/blackbox.png" };
  }
  if (has(providerText, /gitlab/)) {
    return { key: "gitlab", label: "GL", title, iconPath: "/icons/gitlab.svg" };
  }

  return { key: "custom", label: initials(title), title };
}
