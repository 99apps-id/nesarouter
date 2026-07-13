import { ProviderConfig } from "@/core/types";
import { OAUTH_PRESETS } from "@/core/oauthProviderPresets";

function preset(partial: Omit<ProviderConfig, "status" | "apiKey"> & Partial<Pick<ProviderConfig, "status" | "apiKey">>): ProviderConfig {
  return { status: "disabled", apiKey: "", ...partial };
}

function oauthPreset(
  id: string,
  profile: keyof typeof OAUTH_PRESETS,
  priority: number
): ProviderConfig {
  const spec = OAUTH_PRESETS[profile];
  return preset({
    id,
    name: spec.displayName,
    type: spec.providerType,
    tier: "premium",
    baseUrl: spec.baseUrl,
    model: spec.defaultModel,
    models: spec.models?.length ? spec.models : [spec.defaultModel],
    priority,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    oauthProfile: profile
  });
}

/**
 * Seed + UI catalog of API-key providers.
 * Most are OpenAI-compatible: paste key, set Active, Load models / Test.
 * Existing installs pick up missing ids via ensureDefaultProviders().
 */
export const providerPresets: ProviderConfig[] = [
  // --- OAuth subscription (browser Connect / device flow on detail page) ---
  oauthPreset("oauth-github-copilot", "github_copilot", 5),
  oauthPreset("oauth-chatgpt", "openai_codex", 6),
  oauthPreset("oauth-kiro", "kiro", 7),
  oauthPreset("oauth-antigravity", "antigravity", 8),
  oauthPreset("oauth-cursor", "cursor", 9),
  oauthPreset("oauth-claude", "anthropic_claude", 10),
  oauthPreset("oauth-gemini-cli", "gemini_cli", 12),

  // --- Free / local ---
  preset({
    id: "openrouter-free",
    name: "OpenRouter Free",
    type: "openai_compatible",
    tier: "free",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    priority: 10,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "ollama-local",
    name: "Ollama Local",
    type: "openai_compatible",
    tier: "free",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
    priority: 12,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "opencode-free",
    name: "OpenCode Free",
    type: "opencode",
    tier: "free",
    status: "active",
    baseUrl: "https://opencode.ai",
    model: "auto",
    models: ["auto"],
    priority: 16,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "mimo-code-free",
    name: "MiMo Code Free",
    type: "kiro",
    tier: "free",
    baseUrl: "https://api.xiaomimimo.com/api/free-ai/openai/chat",
    model: "mimo-auto",
    models: ["mimo-auto"],
    priority: 18,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),

  // --- China / Asia API-key ---
  preset({
    id: "alibaba-dashscope",
    name: "Alibaba DashScope (Qwen)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen3-coder-plus", "qwen3-coder-flash", "qwen-vl-max"],
    priority: 20,
    inputCostPerMTok: 0.4,
    outputCostPerMTok: 1.2
  }),
  preset({
    id: "alibaba-coding",
    name: "Alibaba Coding (Bailian)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
    model: "qwen3-coder-plus",
    models: ["qwen3.5-plus", "qwen3-coder-next", "qwen3-coder-plus", "qwen3-max-2026-01-23", "kimi-k2.5", "glm-5", "MiniMax-M2.5", "glm-4.7"],
    priority: 21,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "alibaba-coding-intl",
    name: "Alibaba Coding Intl",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1",
    model: "qwen3-coder-plus",
    models: ["qwen3.5-plus", "qwen3-coder-next", "qwen3-coder-plus", "kimi-k2.5", "glm-5", "MiniMax-M2.5", "glm-4.7"],
    priority: 22,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "xiaomi-mimo",
    name: "Xiaomi MiMo",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.xiaomimimo.com/v1",
    model: "mimo-v2.5",
    models: ["mimo-v2.5-pro", "mimo-v2.5", "mimo-v2-omni", "mimo-v2-flash"],
    priority: 23,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "moonshot",
    name: "Moonshot (Kimi CN)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-auto",
    models: ["moonshot-v1-auto", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2.5", "kimi-latest"],
    priority: 24,
    inputCostPerMTok: 0.14,
    outputCostPerMTok: 0.28
  }),
  preset({
    id: "kimi-coding",
    name: "Kimi Coding",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.kimi.com/coding/v1",
    model: "kimi-k2.5",
    models: ["kimi-k2.6", "kimi-k2.5", "kimi-k2.5-thinking", "kimi-latest"],
    priority: 25,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "zhipu-glm",
    name: "Zhipu GLM",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.5-air",
    models: ["glm-5.2", "glm-5.1", "glm-5", "glm-4.7", "glm-4.6", "glm-4.5-air"],
    priority: 26,
    inputCostPerMTok: 0.1,
    outputCostPerMTok: 0.1
  }),
  preset({
    id: "zhipu-glm-coding",
    name: "Zhipu GLM Coding",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    model: "glm-5",
    models: ["glm-5.2", "glm-5.1", "glm-5", "glm-4.7", "glm-4.6", "glm-4.5-air"],
    priority: 27,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "minimax",
    name: "MiniMax",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.minimax.io/v1",
    model: "MiniMax-M2.5",
    models: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.5", "MiniMax-M2.1"],
    priority: 28,
    inputCostPerMTok: 0.3,
    outputCostPerMTok: 1.2
  }),
  preset({
    id: "volcengine-ark",
    name: "Volcengine Ark (Doubao)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
    model: "Doubao-Seed-2.0-lite",
    models: [
      "Doubao-Seed-2.0-Code",
      "Doubao-Seed-2.0-pro",
      "Doubao-Seed-2.0-lite",
      "Doubao-Seed-Code",
      "DeepSeek-V4-Flash",
      "DeepSeek-V4-Pro",
      "GLM-5.1",
      "MiniMax-M2.7",
      "Kimi-K2.6"
    ],
    priority: 29,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "siliconflow",
    name: "SiliconFlow",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.siliconflow.com/v1",
    model: "deepseek-ai/DeepSeek-V3.2",
    models: [
      "deepseek-ai/DeepSeek-V3.2",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen3.5-122B-A10B",
      "zai-org/GLM-5",
      "moonshotai/Kimi-K2.5",
      "MiniMaxAI/MiniMax-M2.5"
    ],
    priority: 30,
    inputCostPerMTok: 0.14,
    outputCostPerMTok: 0.28
  }),
  preset({
    id: "deepseek",
    name: "DeepSeek",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    priority: 31,
    inputCostPerMTok: 0.14,
    outputCostPerMTok: 0.28
  }),
  preset({
    id: "baidu-qianfan",
    name: "Baidu Qianfan",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://qianfan.baidubce.com/v2",
    model: "ernie-4.0-8k",
    models: ["ernie-4.0-8k", "ernie-4.0-turbo-8k", "ernie-3.5-8k", "deepseek-r1", "deepseek-v3"],
    priority: 31,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "stepfun-cn",
    name: "StepFun (China)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.stepfun.com/v1",
    model: "step-3.5-flash",
    models: ["step-3.5-flash", "step-3.7-flash", "step-2-mini", "step-1-flash", "step-1-8k", "step-1-32k"],
    priority: 31,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "stepfun-intl",
    name: "StepFun (Intl)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.stepfun.ai/v1",
    model: "step-3.5-flash",
    models: ["step-3.5-flash", "step-3.7-flash", "step-2-mini", "step-1-flash"],
    priority: 31,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "stepfun-plan-cn",
    name: "StepFun Step Plan (China)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.stepfun.com/step_plan/v1",
    model: "step-3.7-flash",
    models: ["step-3.7-flash", "step-3.5-flash", "step-3.5-flash-2603"],
    priority: 31,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),

  // --- Global API-key ---
  preset({
    id: "groq",
    name: "Groq",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
    priority: 32,
    inputCostPerMTok: 0.05,
    outputCostPerMTok: 0.08
  }),
  preset({
    id: "mistral",
    name: "Mistral",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-medium-latest", "codestral-latest"],
    priority: 33,
    inputCostPerMTok: 0.2,
    outputCostPerMTok: 0.6
  }),
  preset({
    id: "together",
    name: "Together AI",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    priority: 34,
    inputCostPerMTok: 0.06,
    outputCostPerMTok: 0.06
  }),
  preset({
    id: "runware",
    name: "Runware.ai",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.runware.ai/v1",
    model: "minimax:m2.7@0",
    models: [
      "minimax:m2.7@0",
      "minimax:m3@0",
      "google:gemini@3.1-pro",
      "google:gemini@3.5-flash",
      "deepseek:v4@flash",
      "deepseek:v4@pro",
      "moonshotai:kimi@k2.6"
    ],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "perplexity",
    name: "Perplexity",
    type: "openai_compatible",
    tier: "balanced",
    baseUrl: "https://api.perplexity.ai",
    model: "sonar",
    models: ["sonar", "sonar-pro"],
    priority: 34,
    inputCostPerMTok: 1,
    outputCostPerMTok: 1
  }),
  preset({
    id: "cohere",
    name: "Cohere",
    type: "openai_compatible",
    tier: "balanced",
    baseUrl: "https://api.cohere.ai/v1",
    model: "command-a-03-2025",
    models: ["command-a-03-2025", "command-r-plus-08-2024", "command-r-08-2024"],
    priority: 34,
    inputCostPerMTok: 2.5,
    outputCostPerMTok: 10
  }),
  preset({
    id: "hyperbolic",
    name: "Hyperbolic",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.hyperbolic.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct",
      "deepseek-ai/DeepSeek-V3",
      "Qwen/Qwen2.5-Coder-32B-Instruct"
    ],
    priority: 34,
    inputCostPerMTok: 0.4,
    outputCostPerMTok: 0.4
  }),
  preset({
    id: "featherless",
    name: "Featherless",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.featherless.ai/v1",
    model: "deepseek-ai/DeepSeek-V4-Flash",
    models: [
      "deepseek-ai/DeepSeek-V4-Flash",
      "deepseek-ai/DeepSeek-V4-Pro",
      "zai-org/GLM-5.2",
      "moonshotai/Kimi-K2.6"
    ],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "nebius",
    name: "Nebius AI",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.studio.nebius.ai/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    models: ["meta-llama/Llama-3.3-70B-Instruct"],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "venice",
    name: "Venice AI",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.venice.ai/api/v1",
    model: "llama-3.3-70b",
    models: [
      "llama-3.3-70b",
      "venice-uncensored-1-2",
      "qwen3-coder-480b-a35b-instruct-turbo",
      "deepseek-v4-pro"
    ],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "chutes",
    name: "Chutes AI",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://llm.chutes.ai/v1",
    model: "deepseek-ai/DeepSeek-V3",
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "vercel-ai-gateway",
    name: "Vercel AI Gateway",
    type: "openai_compatible",
    tier: "balanced",
    baseUrl: "https://ai-gateway.vercel.sh/v1",
    model: "openai/gpt-4o-mini",
    models: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-4.6", "google/gemini-2.5-flash"],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "huggingface",
    name: "Hugging Face (Router)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://router.huggingface.co/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    models: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct", "deepseek-ai/DeepSeek-R1"],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "deepinfra",
    name: "DeepInfra",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    models: [
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
      "deepseek-ai/DeepSeek-V3"
    ],
    priority: 34,
    inputCostPerMTok: 0.05,
    outputCostPerMTok: 0.05
  }),
  preset({
    id: "novita",
    name: "Novita AI",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.novita.ai/v3/openai",
    model: "meta-llama/llama-3.1-8b-instruct",
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "sambanova",
    name: "SambaNova",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.sambanova.ai/v1",
    model: "Meta-Llama-3.3-70B-Instruct",
    models: ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-R1", "QwQ-32B"],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "github-models",
    name: "GitHub Models",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://models.github.ai/inference",
    model: "openai/gpt-4o-mini",
    models: ["openai/gpt-4o-mini", "openai/gpt-4o", "meta/Llama-3.3-70B-Instruct"],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "opencode-go",
    name: "OpenCode Go",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://opencode.ai/zen/go/v1",
    model: "glm-5.2",
    models: [
      "glm-5.2",
      "kimi-k2.6",
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "mimo-v2.5",
      "minimax-m2.7",
      "qwen3.7-plus"
    ],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "byteplus-ark",
    name: "BytePlus ModelArk",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
    model: "seed-2-0-mini-260215",
    models: [
      "seed-2-0-pro-260328",
      "seed-2-0-mini-260215",
      "seed-2-0-lite-260228",
      "kimi-k2-thinking-251104",
      "glm-4-7-251222"
    ],
    priority: 34,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "xiaomi-tokenplan",
    name: "Xiaomi MiMo (Token Plan)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1",
    model: "mimo-v2.5",
    models: ["mimo-v2.5", "mimo-v2.5-pro"],
    priority: 28,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "fireworks",
    name: "Fireworks",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    model: "accounts/fireworks/models/llama-v3p1-8b-instruct",
    priority: 35,
    inputCostPerMTok: 0.1,
    outputCostPerMTok: 0.1
  }),
  preset({
    id: "cerebras",
    name: "Cerebras",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "llama3.1-8b",
    models: ["llama3.1-8b", "llama-3.3-70b"],
    priority: 36,
    inputCostPerMTok: 0.1,
    outputCostPerMTok: 0.1
  }),
  preset({
    id: "xai-grok",
    name: "xAI Grok",
    type: "openai_compatible",
    tier: "balanced",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-3",
    models: ["grok-4", "grok-4-fast-reasoning", "grok-code-fast-1", "grok-3"],
    priority: 37,
    inputCostPerMTok: 3,
    outputCostPerMTok: 15
  }),
  preset({
    id: "nvidia-nim",
    name: "NVIDIA NIM",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "minimaxai/minimax-m2.7",
    models: [
      "minimaxai/minimax-m2.7",
      "minimaxai/minimax-m3",
      "deepseek-ai/deepseek-v4-flash",
      "z-ai/glm-5.2",
      "moonshotai/kimi-k2.6",
      "nvidia/nemotron-3-ultra-550b-a55b"
    ],
    priority: 38,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "gemini-flash",
    name: "Gemini API (Flash)",
    type: "gemini",
    tier: "cheap",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    priority: 39,
    inputCostPerMTok: 0.3,
    outputCostPerMTok: 2.5
  }),
  preset({
    id: "openai-compatible",
    name: "OpenAI API (usage billing)",
    type: "openai_compatible",
    tier: "balanced",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    priority: 40,
    inputCostPerMTok: 0.15,
    outputCostPerMTok: 0.6
  }),
  preset({
    id: "openrouter-paid",
    name: "OpenRouter Paid",
    type: "openai_compatible",
    tier: "balanced",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.1-8b-instruct",
    priority: 41,
    inputCostPerMTok: 0.05,
    outputCostPerMTok: 0.05
  }),
  preset({
    id: "gemini-pro",
    name: "Gemini API (Pro)",
    type: "gemini",
    tier: "balanced",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-pro",
    priority: 42,
    inputCostPerMTok: 1.25,
    outputCostPerMTok: 10
  }),
  preset({
    id: "openai-gpt-4o",
    name: "OpenAI API (GPT-4o)",
    type: "openai_compatible",
    tier: "premium",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    priority: 50,
    inputCostPerMTok: 2.5,
    outputCostPerMTok: 10
  }),
  preset({
    id: "anthropic-messages",
    name: "Anthropic (API key)",
    type: "anthropic_messages",
    tier: "premium",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
    models: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5"],
    priority: 51,
    inputCostPerMTok: 3,
    outputCostPerMTok: 15
  }),
  preset({
    id: "fal-ai",
    name: "fal.ai",
    type: "openai_compatible",
    tier: "balanced",
    baseUrl: "https://fal.run/fal-ai",
    model: "any-llm",
    models: ["any-llm", "flux/dev", "flux/schnell"],
    priority: 52,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "replicate",
    name: "Replicate",
    type: "openai_compatible",
    tier: "balanced",
    baseUrl: "https://api.replicate.com/v1",
    model: "meta/meta-llama-3-8b-instruct",
    priority: 53,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "ai21",
    name: "AI21 Labs",
    type: "openai_compatible",
    tier: "balanced",
    baseUrl: "https://api.ai21.com/studio/v1",
    model: "jamba-large",
    models: ["jamba-large", "jamba-mini"],
    priority: 54,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "lambda-labs",
    name: "Lambda Labs",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.lambdalabs.com/v1",
    model: "llama-3.1-70b-instruct",
    priority: 55,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "lepton",
    name: "Lepton AI",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.lepton.ai/v1",
    model: "llama3-8b",
    priority: 56,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  }),
  preset({
    id: "mystic",
    name: "Mystic (OpenRouter alt)",
    type: "openai_compatible",
    tier: "cheap",
    baseUrl: "https://api.mystic.ai/v1",
    model: "auto",
    priority: 57,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  })
];

/** Group labels for the New Provider preset dropdown. */
export const providerPresetGroups: Array<{ label: string; ids: string[] }> = [
  {
    label: "OAuth / account sign-in",
    ids: [
      "oauth-github-copilot",
      "oauth-chatgpt",
      "oauth-kiro",
      "oauth-antigravity",
      "oauth-cursor",
      "oauth-claude",
      "oauth-gemini-cli"
    ]
  },
  {
    label: "Free / local",
    ids: ["openrouter-free", "ollama-local", "opencode-free", "mimo-code-free", "opencode-go"]
  },
  {
    label: "China / Asia API key",
    ids: [
      "alibaba-dashscope",
      "alibaba-coding",
      "alibaba-coding-intl",
      "xiaomi-mimo",
      "xiaomi-tokenplan",
      "moonshot",
      "kimi-coding",
      "zhipu-glm",
      "zhipu-glm-coding",
      "minimax",
      "volcengine-ark",
      "byteplus-ark",
      "siliconflow",
      "deepseek",
      "baidu-qianfan",
      "stepfun-cn",
      "stepfun-intl",
      "stepfun-plan-cn"
    ]
  },
  {
    label: "Global API key",
    ids: [
      "runware",
      "perplexity",
      "groq",
      "mistral",
      "together",
      "fireworks",
      "cerebras",
      "hyperbolic",
      "featherless",
      "nebius",
      "venice",
      "chutes",
      "deepinfra",
      "novita",
      "sambanova",
      "huggingface",
      "github-models",
      "vercel-ai-gateway",
      "cohere",
      "xai-grok",
      "nvidia-nim",
      "gemini-flash",
      "gemini-pro",
      "openai-compatible",
      "openrouter-paid",
      "openai-gpt-4o",
      "anthropic-messages",
      "fal-ai",
      "replicate",
      "ai21",
      "lambda-labs",
      "lepton",
      "mystic"
    ]
  }
];

export function customProviderTemplate(): ProviderConfig {
  return {
    id: "",
    name: "",
    type: "openai_compatible",
    tier: "cheap",
    status: "disabled",
    baseUrl: "",
    apiKey: "",
    model: "",
    priority: 100,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0
  };
}
