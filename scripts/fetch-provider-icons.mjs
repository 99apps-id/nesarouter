/**
 * Fetch official provider brand marks (no Simple Icons).
 *
 * Sources researched via agent-reach style tooling (gh API + web):
 * - decolua/9router public/providers (MIT provider-asset set)
 * - MoonshotAI/Branding-Guide (official Kimi / K marks)
 * - Hugging Face documentation-images (Hyperbolic)
 * - Primer octicons (GitHub Copilot UI mark)
 * - Vendor sites (Baidu favicon SVG, Replicate touch icon)
 * - Existing local official SVGs: together, runware, cerebras
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const dir = path.join(process.cwd(), "public", "providers");
const NINEROUTER = "https://raw.githubusercontent.com/decolua/9router/master/public/providers";

/** 9router filename → local filename (skip known duplicate siblings — handled in officialDirect) */
const from9router = {
  "openrouter.png": "openrouter.png",
  "deepseek.png": "deepseek.png",
  "gemini.png": "gemini.png",
  "gemini-cli.png": "gemini-cli.png",
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
  "minimax.png": "minimax.png",
  "xai.png": "xai.png",
  "xiaomi-mimo.png": "xiaomi.png",
  "codex.png": "codex.png",
  "kiro.png": "kiro.png",
  "antigravity.png": "antigravity.png",
  "opencode.png": "opencode.png",
  "mimo-free.png": "mimo-free.png",
  "nebius.png": "nebius.png",
  "chutes.png": "chutes.png",
  "volcengine-ark.png": "volcengine.png",
  "byteplus.png": "byteplus.png",
  "alicode.png": "alibaba-cloud.png",
  "azure.png": "azure.png",
  "blackbox.png": "blackbox.png",
  "iflow.png": "iflow.png",
  "kilocode.png": "kilocode.png",
  "cline.png": "cline.png",
  "clinepass.png": "clinepass.png",
  "codebuddy-cn.png": "codebuddy-cn.png",
  "minimax-cn.png": "minimax-cn.png",
  "kimchi.png": "kimchi.png",
  "vertex.png": "vertex.png"
};

/** Direct official / distinct vendor URLs (overrides 9router duplicates) */
const officialDirect = {
  "kimi.png":
    "https://raw.githubusercontent.com/MoonshotAI/Branding-Guide/main/scenarios/03-icon-without-kimi/kimi-icon-round.png",
  "moonshot.png":
    "https://raw.githubusercontent.com/MoonshotAI/Branding-Guide/main/scenarios/04-k-only/k-only-color.png",
  "hyperbolic.png":
    "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/inference-providers/logos/hyperbolic-dark.png",
  "copilot.svg": "https://raw.githubusercontent.com/primer/octicons/main/icons/copilot-24.svg",
  "baidu.svg": "https://www.baidu.com/img/baidu_85beaf5496f291521eb75ba38eacbd87.svg",
  "replicate.png": "https://avatars.githubusercontent.com/u/60410876?s=200&v=4"
};

const localDistinctSvgs = {
  "opencode-go.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img">
  <rect width="64" height="64" rx="14" fill="#0B1220"/>
  <path d="M18 40V24h8.2c5.2 0 8.4 2.6 8.4 7.1 0 4.6-3.3 7.3-8.6 7.3H24.6V40H18zm6.6-10.6v5.1h1.5c2.4 0 3.8-1.1 3.8-2.6s-1.4-2.5-3.7-2.5h-1.6z" fill="#7CFFB2"/>
  <text x="46" y="42" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14" font-weight="800" fill="#7CFFB2">GO</text>
</svg>
`,
  "xiaomi-tokenplan.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img">
  <rect width="64" height="64" rx="14" fill="#FF6900"/>
  <text x="32" y="39" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22" font-weight="800" fill="#fff">TP</text>
</svg>
`
};

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

for (const [source, dest] of Object.entries(from9router)) {
  await download(`${NINEROUTER}/${source}`, dest);
}

for (const [file, url] of Object.entries(officialDirect)) {
  await download(url, file);
}

for (const [file, svg] of Object.entries(localDistinctSvgs)) {
  fs.writeFileSync(path.join(dir, file), svg);
  console.log("WROTE", file);
}

console.log("Done. Official SVGs kept: together.svg, runware.svg, cerebras.svg");
