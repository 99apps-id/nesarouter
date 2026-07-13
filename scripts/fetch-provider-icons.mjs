/**
 * Fetch official provider brand marks (no Simple Icons).
 *
 * Sources researched via agent-reach style tooling (gh API + web):
 * - decolua/9router public/providers (MIT provider-asset set)
 * - MoonshotAI/Branding-Guide (official Kimi marks)
 * - Vendor sites (Baidu favicon SVG, Replicate touch icon)
 * - Existing local official SVGs: together, runware, cerebras
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const dir = path.join(process.cwd(), "public", "providers");
const NINEROUTER = "https://raw.githubusercontent.com/decolua/9router/master/public/providers";

/** 9router filename → local filename */
const from9router = {
  "openrouter.png": "openrouter.png",
  "deepseek.png": "deepseek.png",
  "gemini.png": "gemini.png",
  "openai.png": "openai.png",
  "mistral.png": "mistral.png",
  "groq.png": "groq.png",
  "ollama.png": "ollama.png",
  "anthropic.png": "anthropic.png",
  "claude.png": "claude.png",
  "github.png": "github.png",
  "nvidia.png": "nvidia.png",
  "perplexity.png": "perplexity.png",
  "qwen.png": "qwen.png",
  "huggingface.png": "huggingface.png",
  "cursor.png": "cursor.png",
  "fal-ai.png": "fal-ai.png",
  "fireworks.png": "fireworks.png",
  "cohere.png": "cohere.png",
  "siliconflow.png": "siliconflow.png",
  "glm.png": "zhipu.png",
  "kimi.png": "kimi.png",
  "minimax.png": "minimax.png",
  "xai.png": "xai.png",
  "xiaomi-mimo.png": "xiaomi.png",
  "codex.png": "codex.png",
  "kiro.png": "kiro.png",
  "antigravity.png": "antigravity.png",
  "opencode.png": "opencode.png",
  "mimo-free.png": "mimo-free.png",
  "hyperbolic.png": "hyperbolic.png",
  "nebius.png": "nebius.png",
  "chutes.png": "chutes.png",
  "volcengine-ark.png": "volcengine.png",
  "alicode.png": "alibaba-cloud.png"
};

/** Direct official vendor URLs */
const officialDirect = {
  "kimi.png":
    "https://raw.githubusercontent.com/MoonshotAI/Branding-Guide/main/scenarios/03-icon-without-kimi/kimi-icon-round.png",
  "moonshot.png":
    "https://raw.githubusercontent.com/MoonshotAI/Branding-Guide/main/scenarios/03-icon-without-kimi/kimi-icon-round.png",
  "baidu.svg": "https://www.baidu.com/img/baidu_85beaf5496f291521eb75ba38eacbd87.svg",
  "replicate.png": "https://avatars.githubusercontent.com/u/60410876?s=200&v=4"
};

const removeSimpleIcons = [
  "openrouter.svg",
  "deepseek.svg",
  "gemini.svg",
  "openai.svg",
  "mistral.svg",
  "groq.svg",
  "ollama.svg",
  "anthropic.svg",
  "claude.svg",
  "github.svg",
  "nvidia.svg",
  "perplexity.svg",
  "qwen.svg",
  "huggingface.svg",
  "cursor.svg",
  "fal.svg",
  "fireworks.svg",
  "cohere.svg",
  "siliconflow.svg",
  "zhipu.svg",
  "volcengine.svg",
  "codex.svg",
  "kiro.svg",
  "antigravity.svg",
  "opencode.svg",
  "mimo-free.svg",
  "stepfun.svg",
  "meta.svg",
  "replicate.svg",
  "amazon.svg",
  "kimi.svg",
  "moonshot.svg",
  "minimax.svg",
  "xai.svg",
  "xiaomi.svg",
  "baidu.svg",
  "alibaba-cloud.svg"
];

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode, data: Buffer.concat(chunks) }));
      })
      .on("error", reject);
  });
}

async function download(url, file) {
  const { status, data } = await get(url);
  if (status !== 200 || data.length < 32) {
    console.log("FAIL", file, status);
    return false;
  }
  fs.writeFileSync(path.join(dir, file), data);
  console.log("OK", file, `(${data.length} bytes)`);
  return true;
}

for (const file of removeSimpleIcons) {
  const target = path.join(dir, file);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    console.log("REMOVED", file);
  }
}

for (const [source, dest] of Object.entries(from9router)) {
  await download(`${NINEROUTER}/${source}`, dest);
}

for (const [file, url] of Object.entries(officialDirect)) {
  await download(url, file);
}

console.log("Done. Official SVGs kept: together.svg, runware.svg, cerebras.svg");
