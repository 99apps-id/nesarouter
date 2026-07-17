import { ModelAlias } from "@/core/aliases";
import { Combo, NesaStore, ProviderConfig } from "@/core/types";

export const CLI_TOOL_IDS = [
  "claude-code",
  "codex",
  "cursor",
  "cline",
  "openclaw",
  "opencode",
  "hermes",
  "gemini-cli",
  "qwen-code",
  "continue",
  "roo",
  "kilo",
  "amp",
  "droid",
  "cowork",
  "deepseek-tui",
  "jcode",
  "generic"
] as const;

export type CliToolId = (typeof CLI_TOOL_IDS)[number];

/** Tools that Apply writes (or merges) into a local settings file on this machine. */
export const CLI_FILE_PATCHABLE_IDS = [
  "claude-code",
  "codex",
  "qwen-code",
  "hermes",
  "openclaw",
  "deepseek-tui",
  "jcode"
] as const satisfies readonly CliToolId[];

export function isCliToolFilePatchable(tool: string): boolean {
  return (CLI_FILE_PATCHABLE_IDS as readonly string[]).includes(tool);
}

export interface CliConfigFile {
  path: string;
  content: string;
  /** Default: merge-json for *.json, replace otherwise. */
  writeMode?: "merge-json" | "merge-toml" | "merge-yaml-model" | "replace";
  tomlTable?: string;
}

export interface CliToolConfig {
  summary: string;
  files: CliConfigFile[];
  env: Record<string, string>;
  instructions?: string;
}

function v1Base(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (/\/v1$/i.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

function loopbackBase(baseUrl: string) {
  return baseUrl.replace("http://localhost", "http://127.0.0.1");
}

export function normalizeCliToolId(tool: string): CliToolId {
  return (CLI_TOOL_IDS.includes(tool as CliToolId) ? tool : "generic") as CliToolId;
}

export function resolveCliModel(store: NesaStore, modelTarget: string) {
  const target = modelTarget.trim();
  if (!target || target === "auto" || target === "nesa/router") {
    return { model: "auto", label: "Auto — routing engine + fallback" };
  }

  if (target.startsWith("combo:")) {
    const name = target.slice("combo:".length);
    const combo = store.combos.find((item) => item.name === name || item.id === name);
    if (!combo) throw new Error(`Combo '${name}' was not found.`);
    const strategy = combo.strategy === "round_robin" ? "round robin" : "fallback";
    return { model: combo.name, label: `Combo ${combo.name} (${strategy})` };
  }

  if (target.startsWith("alias:")) {
    const name = target.slice("alias:".length);
    const alias = store.aliases?.find((item) => item.alias === name);
    if (!alias) throw new Error(`Alias '${name}' was not found.`);
    return { model: alias.alias, label: `Alias ${alias.alias} → ${alias.target}` };
  }

  if (target.startsWith("provider:")) {
    const id = target.slice("provider:".length);
    const provider = store.providers.find((item) => item.id === id);
    if (!provider) throw new Error(`Provider '${id}' was not found.`);
    return { model: provider.model || provider.id, label: `Provider ${provider.name}` };
  }

  const combo = store.combos.find((item) => item.name === target || item.id === target);
  if (combo) {
    const strategy = combo.strategy === "round_robin" ? "round robin" : "fallback";
    return { model: combo.name, label: `Combo ${combo.name} (${strategy})` };
  }

  const alias = store.aliases?.find((item) => item.alias === target);
  if (alias) return { model: alias.alias, label: `Alias ${alias.alias} → ${alias.target}` };

  return { model: target, label: target };
}

export function buildCliToolConfig(tool: CliToolId, baseUrl: string, apiKey: string, model: string): CliToolConfig {
  const v1 = v1Base(baseUrl);
  const loopback = loopbackBase(baseUrl);

  switch (tool) {
    case "claude-code":
      return {
        summary: "Claude Code — override Anthropic endpoint via settings.json (merge)",
        files: [
          {
            path: "~/.claude/settings.json",
            writeMode: "merge-json",
            content: JSON.stringify(
              {
                hasCompletedOnboarding: true,
                env: {
                  ANTHROPIC_BASE_URL: v1,
                  // Gateway-style Bearer auth (preferred over ANTHROPIC_API_KEY for custom base URLs).
                  ANTHROPIC_AUTH_TOKEN: apiKey,
                  ANTHROPIC_MODEL: model
                }
              },
              null,
              2
            )
          }
        ],
        env: {
          ANTHROPIC_BASE_URL: v1,
          ANTHROPIC_AUTH_TOKEN: apiKey,
          ANTHROPIC_MODEL: model
        }
      };
    case "codex":
      return {
        summary: "OpenAI Codex CLI — Responses endpoint via NesaRouter /v1",
        files: [
          {
            path: "~/.codex/config.toml",
            writeMode: "merge-toml",
            content: `model = "${model}"\nmodel_provider = "nesa"\n\n[model_providers.nesa]\nname = "NesaRouter"\nbase_url = "${v1}"\nwire_api = "responses"\nexperimental_bearer_token = "${apiKey}"`
          }
        ],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model }
      };
    case "gemini-cli":
      return {
        summary: "Gemini CLI — generic OpenAI-compatible override unsupported",
        files: [],
        env: {},
        instructions: "Gemini CLI resmi tidak menyediakan provider OpenAI-compatible generik. Gunakan Qwen Code, Codex, Claude Code, OpenClaw, atau konfigurasi Generic untuk NesaRouter."
      };
    case "qwen-code":
      return {
        summary: "Qwen Code CLI — settings.json (merge)",
        files: [
          {
            path: "~/.qwen/settings.json",
            writeMode: "merge-json",
            content: JSON.stringify(
              {
                modelProviders: {
                  openai: [{ id: model, name: `NesaRouter (${model})`, baseUrl: v1, envKey: "NESA_ROUTER_API_KEY" }]
                },
                env: { NESA_ROUTER_API_KEY: apiKey },
                security: { auth: { selectedType: "openai" } },
                model: { name: model }
              },
              null,
              2
            )
          }
        ],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model }
      };
    case "hermes":
      return {
        summary: "Hermes Agent — config + env",
        files: [
          {
            path: "~/.hermes/config.yaml",
            writeMode: "merge-yaml-model",
            content: `model:\n  default: "${model}"\n  provider: "custom"\n  base_url: "${v1}"\n`
          },
          { path: "~/.hermes/.env", content: `OPENAI_API_KEY=${apiKey}\nOPENAI_BASE_URL=${v1}\nOPENAI_MODEL=${model}\n` }
        ],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey }
      };
    case "openclaw":
      return {
        summary: "OpenClaw — openclaw.json (NesaRouter provider, merge)",
        files: [
          {
            path: "~/.openclaw/openclaw.json",
            writeMode: "merge-json",
            content: JSON.stringify(
              {
                agents: {
                  defaults: {
                    model: { primary: `nesa/${model}` },
                    models: { [`nesa/${model}`]: {} }
                  }
                },
                models: {
                  providers: {
                    nesa: {
                      baseUrl: v1Base(loopback),
                      apiKey,
                      api: "openai-completions",
                      models: [{ id: model, name: "NesaRouter" }]
                    }
                  }
                }
              },
              null,
              2
            )
          }
        ],
        env: {}
      };
    case "continue":
      return {
        summary: "Continue — config.yaml manual additive setup",
        files: [],
        env: {},
        instructions: `Tambahkan entry berikut ke config.yaml melalui Continue Config tanpa mengganti model lain:\n\nmodels:\n  - name: NesaRouter (${model})\n    provider: openai\n    model: ${model}\n    apiBase: ${v1}\n    apiKey: ${apiKey}`
      };
    case "roo":
      return {
        summary: "Roo Code — OpenAI-compatible base",
        files: [],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model },
        instructions: `Buka Roo Settings → API Provider → OpenAI Compatible, lalu isi:\nBase URL: ${v1}\nAPI Key: ${apiKey}\nModel: ${model}`
      };
    case "kilo":
      return {
        summary: "Kilo Code — OpenAI-compatible",
        files: [],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model },
        instructions: `Kilo Code settings → OpenAI Compatible\nBase URL: ${v1}\nAPI Key: ${apiKey}\nModel: ${model}`
      };
    case "amp":
      return {
        summary: "Amp CLI — OpenAI env",
        files: [],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model },
        instructions: `Jalankan skrip install di bawah, lalu:\namp --model "${model}"`
      };
    case "droid":
      return {
        summary: "Factory Droid — OpenAI-compatible env",
        files: [],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model }
      };
    case "cowork":
      return {
        summary: "Claude Cowork — third-party inference",
        files: [],
        env: { ANTHROPIC_BASE_URL: v1, ANTHROPIC_AUTH_TOKEN: apiKey, ANTHROPIC_MODEL: model },
        instructions: `Cowork third-party inference:\n${v1}\nAuth token: ${apiKey}\nModel: ${model}`
      };
    case "deepseek-tui":
      return {
        summary: "DeepSeek TUI — config.toml",
        files: [
          {
            path: "~/.deepseek/config.toml",
            writeMode: "merge-toml",
            tomlTable: "provider",
            content: `[provider]\nname = "openai"\nbase_url = "${v1}"\napi_key = "${apiKey}"\nmodel = "${model}"\n`
          }
        ],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model }
      };
    case "jcode":
      return {
        summary: "jcode — OpenAI-compatible provider",
        files: [
          {
            path: "~/.jcode/config.toml",
            writeMode: "merge-toml",
            tomlTable: "providers.nesa",
            content: `[providers.nesa]\ntype = "openai"\nbase_url = "${v1}"\napi_key = "${apiKey}"\nmodel = "${model}"\n`
          }
        ],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model }
      };
    case "cursor":
      return {
        summary: "Cursor — OpenAI base URL override",
        files: [],
        env: {},
        instructions: `Cursor → Settings → Models → Advanced Override\nOpenAI API Base URL: ${v1}\nOpenAI API Key: ${apiKey}\nModel: ${model}\n\nCatatan: Cursor mungkin tetap lewat cloud kecuali pakai Tunnel.`
      };
    case "cline":
    case "opencode":
      return {
        summary: `${tool} — OpenAI Compatible`,
        files: [],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model },
        instructions: `Tambah provider OpenAI-compatible:\nBase URL: ${v1}\nAPI Key: ${apiKey}\nModel: ${model}`
      };
    case "generic":
    default:
      return {
        summary: "Generic OpenAI-compatible",
        files: [],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model }
      };
  }
}

function expandPathForBash(filePath: string) {
  if (filePath.startsWith("~/")) return `"$HOME/${filePath.slice(2)}"`;
  return `"${filePath}"`;
}

function expandPathForPowerShell(filePath: string) {
  if (filePath.startsWith("~/")) {
    const rest = filePath.slice(2).replace(/\\/g, "/");
    return `Join-Path $env:USERPROFILE "${rest.replace(/\//g, '\\')}"`;
  }
  return `"${filePath}"`;
}

export function buildCliInstallScripts(config: CliToolConfig) {
  const bashLines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'echo "Applying NesaRouter CLI config (merge override)…"',
    'command -v node >/dev/null 2>&1 || { echo "Node.js required to merge JSON config safely." >&2; exit 1; }'
  ];
  const psLines = [
    "$ErrorActionPreference = 'Stop'",
    'Write-Host "Applying NesaRouter CLI config (merge override)…"',
    "if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js required to merge JSON config safely.' }"
  ];

  for (const file of config.files) {
    const mode = file.writeMode ?? (file.path.endsWith(".json") ? "merge-json" : "replace");
    const dirBash = expandPathForBash(file.path);
    const dirPs = expandPathForPowerShell(file.path);

    if (mode === "merge-json") {
      const patchLiteral = JSON.stringify(file.content);
      bashLines.push(`TARGET=${dirBash}`);
      bashLines.push(`PATCH=${patchLiteral}`);
      bashLines.push("export TARGET PATCH");
      bashLines.push(`node -e ${JSON.stringify(nodeMergeSnippetBash())}`);
      psLines.push(`$target = ${dirPs}`);
      psLines.push(`$env:NESA_TARGET = $target`);
      psLines.push(`$env:NESA_PATCH = ${JSON.stringify(file.content)}`);
      psLines.push(`node -e ${JSON.stringify(nodeMergeSnippetPs())}`);
      continue;
    }

    if (mode === "merge-toml") {
      bashLines.push(`TARGET=${dirBash}`);
      bashLines.push(`PATCH=${JSON.stringify(file.content)}`);
      bashLines.push("export TARGET PATCH");
      bashLines.push(`node -e ${JSON.stringify(nodeMergeTomlSnippet("TARGET", "PATCH", file.tomlTable))}`);
      psLines.push(`$target = ${dirPs}`);
      psLines.push(`$env:NESA_TARGET = $target`);
      psLines.push(`$env:NESA_PATCH = ${JSON.stringify(file.content)}`);
      psLines.push(`node -e ${JSON.stringify(nodeMergeTomlSnippet("NESA_TARGET", "NESA_PATCH", file.tomlTable))}`);
      continue;
    }

    if (mode === "merge-yaml-model") {
      bashLines.push(`TARGET=${dirBash}`);
      bashLines.push(`PATCH=${JSON.stringify(file.content)}`);
      bashLines.push("export TARGET PATCH");
      bashLines.push(`node -e ${JSON.stringify(nodeMergeYamlModelSnippet())}`);
      psLines.push(`$target = ${dirPs}`);
      psLines.push(`$env:NESA_TARGET = $target`);
      psLines.push(`$env:NESA_PATCH = ${JSON.stringify(file.content)}`);
      psLines.push(`node -e ${JSON.stringify(nodeMergeYamlModelSnippet("NESA_TARGET", "NESA_PATCH"))}`);
      continue;
    }

    bashLines.push(`mkdir -p "$(dirname ${dirBash})"`);
    bashLines.push(`cat > ${dirBash} <<'NESA_EOF'`);
    bashLines.push(file.content);
    bashLines.push("NESA_EOF");

    psLines.push(`$target = ${dirPs}`);
    psLines.push("$dir = Split-Path -Parent $target");
    psLines.push("if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }");
    psLines.push("@'");
    psLines.push(file.content.replace(/\r/g, ""));
    psLines.push("'@ | Set-Content -Path $target -Encoding utf8 -NoNewline");
  }

  if (Object.keys(config.env).length) {
    const exports = Object.entries(config.env).map(([key, value]) => `export ${key}=${JSON.stringify(value)}`);
    bashLines.push('NESA_ENV_FILE="$HOME/.config/nesarouter/cli.env"');
    bashLines.push('mkdir -p "$(dirname "$NESA_ENV_FILE")"');
    bashLines.push('cat > "$NESA_ENV_FILE" <<\'NESA_ENV_EOF\'');
    bashLines.push(...exports);
    bashLines.push("NESA_ENV_EOF");
    bashLines.push('chmod 600 "$NESA_ENV_FILE"');
    bashLines.push('touch "$HOME/.profile"');
    bashLines.push('grep -Fq \'. "$HOME/.config/nesarouter/cli.env"\' "$HOME/.profile" || printf \'\\n. "$HOME/.config/nesarouter/cli.env"\\n\' >> "$HOME/.profile"');
    bashLines.push('source "$NESA_ENV_FILE"');
    bashLines.push('echo "Environment saved for future shells via ~/.profile."');
    const psEnv = Object.entries(config.env)
      .map(([key, value]) => `[Environment]::SetEnvironmentVariable('${key}', ${JSON.stringify(value)}, 'User')`)
      .join("\n");
    psLines.push(psEnv);
    psLines.push('Write-Host "Environment variables saved for current user."');
  }

  bashLines.push('echo "Done — existing settings kept; NesaRouter keys merged/overridden."');
  psLines.push('Write-Host "Done — existing settings kept; NesaRouter keys merged/overridden."');

  return {
    bash: bashLines.join("\n"),
    powershell: psLines.join("\n")
  };
}

function nodeMergeTomlSnippet(targetEnv = "TARGET", patchEnv = "PATCH", tableName?: string) {
  return [
    "const fs=require('fs'),path=require('path');",
    `const target=process.env.${targetEnv},patch=process.env.${patchEnv};`,
    "fs.mkdirSync(path.dirname(target),{recursive:true});",
    "let base='';try{base=fs.readFileSync(target,'utf8')}catch{}",
    "const keys=[...patch.split(/^\\s*\\[/m)[0].matchAll(/^([A-Za-z0-9_-]+)\\s*=/gm)].map(m=>m[1]);",
    "let insideTable=false;const kept=base.split(/\\r?\\n/).filter(line=>{if(/^\\s*\\[/.test(line))insideTable=true;if(!insideTable&&keys.some(k=>new RegExp('^\\\\s*'+k+'\\\\s*=').test(line)))return false;return true}).join('\\n');",
    `const table=${JSON.stringify(tableName ?? "model_providers.nesa")};`,
    "const esc=table.replaceAll('.','\\\\\\\\.');",
    "const stripped=kept.replace(new RegExp('(^|\\\\n)\\\\['+esc+'\\\\][\\\\s\\\\S]*?(?=\\\\n\\\\s*\\\\[[^\\\\]]+\\\\]|$)','g'),'\\n').trim();",
    "fs.writeFileSync(target,(stripped?stripped+'\\n\\n':'')+patch.trim()+'\\n',{mode:0o600});",
    "try{fs.chmodSync(target,0o600)}catch{}",
    "console.log('Merged',target);"
  ].join("");
}

function nodeMergeYamlModelSnippet(targetEnv = "TARGET", patchEnv = "PATCH") {
  return [
    "const fs=require('fs'),path=require('path');",
    `const target=process.env.${targetEnv},patch=process.env.${patchEnv};`,
    "fs.mkdirSync(path.dirname(target),{recursive:true});",
    "let base='';try{base=fs.readFileSync(target,'utf8')}catch{}",
    "const lines=base.split(/\\r?\\n/);let inModel=false;const kept=lines.filter(line=>{if(/^model:\\s*$/.test(line)){inModel=true;return true}if(inModel&&/^\\S/.test(line)){inModel=false}return !(inModel&&/^\\s{2}(default|provider|base_url):/.test(line))});",
    "const patchLines=patch.trim().split(/\\r?\\n/).slice(1);let idx=kept.findIndex(l=>/^model:\\s*$/.test(l));if(idx<0){kept.push('model:',...patchLines)}else{kept.splice(idx+1,0,...patchLines)}",
    "fs.writeFileSync(target,kept.join('\\n').replace(/\\n{3,}/g,'\\n\\n').trim()+'\\n');",
    "console.log('Merged',target);"
  ].join("");
}

/** Inline Node merge (bash): uses env TARGET + PATCH (raw JSON text). */
function nodeMergeSnippetBash() {
  return [
    "const fs=require('fs'),path=require('path');",
    "const target=process.env.TARGET;",
    "const patch=JSON.parse(process.env.PATCH);",
    "fs.mkdirSync(path.dirname(target),{recursive:true});",
    "let base={};",
    "try{base=JSON.parse(fs.readFileSync(target,'utf8').replace(/,(\\s*[}\\]])/g,'$1'));}catch(e){if(e.code!=='ENOENT')throw new Error('Existing JSON is invalid: '+target)}",
    "const merge=(a,b)=>Array.isArray(b)?b:(b&&typeof b==='object'&&!Array.isArray(b)?Object.fromEntries(Object.keys({...a,...b}).map(k=>[k,merge(a?.[k],b[k])])):b);",
    "const out=(!base||typeof base!=='object'||Array.isArray(base))?patch:merge(base,patch);",
    "fs.writeFileSync(target,JSON.stringify(out,null,2)+'\\n');",
    "console.log('Merged',target);"
  ].join("");
}

/** Inline Node merge (PowerShell): uses $target and $patch JS string vars via -e args. */
function nodeMergeSnippetPs() {
  // PowerShell passes $target/$patch into node via env to avoid escaping hell.
  return [
    "const fs=require('fs'),path=require('path');",
    "const target=process.env.NESA_TARGET;",
    "const patch=JSON.parse(process.env.NESA_PATCH);",
    "fs.mkdirSync(path.dirname(target),{recursive:true});",
    "let base={};",
    "try{base=JSON.parse(fs.readFileSync(target,'utf8').replace(/,(\\s*[}\\]])/g,'$1'));}catch(e){if(e.code!=='ENOENT')throw new Error('Existing JSON is invalid: '+target)}",
    "const merge=(a,b)=>Array.isArray(b)?b:(b&&typeof b==='object'&&!Array.isArray(b)?Object.fromEntries(Object.keys({...a,...b}).map(k=>[k,merge(a?.[k],b[k])])):b);",
    "const out=(!base||typeof base!=='object'||Array.isArray(base))?patch:merge(base,patch);",
    "fs.writeFileSync(target,JSON.stringify(out,null,2)+'\\n');",
    "console.log('Merged',target);"
  ].join("");
}

export function listCliModelTargets(input: Pick<NesaStore, "combos" | "aliases" | "providers">) {
  const store = input;
  const options = [{ value: "auto", label: "Auto — routing engine + fallback" }];
  for (const combo of store.combos) {
    const strategy = combo.strategy === "round_robin" ? "round robin" : "fallback";
    options.push({ value: `combo:${combo.name}`, label: `Combo: ${combo.name} (${strategy})` });
  }
  for (const alias of store.aliases ?? []) {
    options.push({ value: `alias:${alias.alias}`, label: `Alias: ${alias.alias} → ${alias.target}` });
  }
  for (const provider of store.providers.filter((item) => item.status === "active")) {
    options.push({
      value: `provider:${provider.id}`,
      label: `Provider: ${provider.name} (${provider.model || provider.id})`
    });
  }
  return options;
}
