import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CliConfigFile, CliToolConfig, CliToolId } from "@/lib/cliToolConfig";

/** Deep-merge objects; arrays and scalars from the patch win. */
export function deepMergeJson(base: unknown, patch: unknown): unknown {
  if (Array.isArray(patch)) return patch;
  if (patch && typeof patch === "object" && !Array.isArray(patch)) {
    const baseObj =
      base && typeof base === "object" && !Array.isArray(base) ? (base as Record<string, unknown>) : {};
    const out: Record<string, unknown> = { ...baseObj };
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      out[key] = deepMergeJson(out[key], value);
    }
    return out;
  }
  return patch;
}

export function expandCliHomePath(filePath: string) {
  if (filePath.startsWith("~/") || filePath === "~") {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function readJsonFile(filePath: string, strict = false): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const stripped = raw.replace(/,(\s*[}\]])/g, "$1");
    const parsed = JSON.parse(stripped);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (strict) throw new Error(`Cannot safely patch ${filePath}: existing JSON is invalid. Fix or back up the file first.`, { cause: error });
    return {};
  }
}

export function applyCliConfigFile(file: CliConfigFile) {
  const target = expandCliHomePath(file.path);
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
  } catch (error) {
    throw cliWriteError(target, error);
  }

  const mode = file.writeMode ?? (file.path.endsWith(".json") ? "merge-json" : "replace");
  if (mode === "merge-json") {
    let patch: unknown;
    try {
      patch = JSON.parse(file.content);
    } catch {
      throw new Error(`Invalid JSON patch for ${file.path}`);
    }
    const merged = deepMergeJson(readJsonFile(target, true), patch);
    try { fs.writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`, "utf8"); } catch (error) { throw cliWriteError(target, error); }
    return { path: target, mode: "merge-json" as const };
  }

  if (mode === "merge-toml") {
    const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    try {
      fs.writeFileSync(target, mergeTomlConfig(existing, file.content, file.tomlTable), { encoding: "utf8", mode: 0o600 });
      if (process.platform !== "win32") fs.chmodSync(target, 0o600);
    } catch (error) { throw cliWriteError(target, error); }
    return { path: target, mode: "merge-toml" as const };
  }

  if (mode === "merge-yaml-model") {
    const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    try { fs.writeFileSync(target, mergeHermesModelYaml(existing, file.content), "utf8"); } catch (error) { throw cliWriteError(target, error); }
    return { path: target, mode: "merge-yaml-model" as const };
  }

  // Env files: upsert Nesa keys instead of wiping unrelated vars.
  if (target.endsWith(".env") || path.basename(target) === ".env") {
    const next = upsertEnvFile(fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "", file.content);
    try { fs.writeFileSync(target, next.endsWith("\n") ? next : `${next}\n`, "utf8"); } catch (error) { throw cliWriteError(target, error); }
    return { path: target, mode: "replace" as const };
  }

  try { fs.writeFileSync(target, file.content.endsWith("\n") ? file.content : `${file.content}\n`, "utf8"); } catch (error) { throw cliWriteError(target, error); }
  return { path: target, mode: "replace" as const };
}

function cliWriteError(target: string, error: unknown) {
  const cause = error as NodeJS.ErrnoException;
  if (cause?.code === "EACCES" || cause?.code === "EPERM") {
    return new Error(`Cannot write ${target}: permission denied. Ensure the NesaRouter service user owns the file and its parent directory (for example: sudo chown -R $(systemctl show nesarouter -p User --value) ${path.dirname(target)}).`);
  }
  return error instanceof Error ? error : new Error(`Cannot write ${target}.`);
}

export function mergeTomlConfig(existing: string, patch: string, tableName?: string) {
  const scalarKeys = [...patch.split(/^\s*\[/m)[0].matchAll(/^([A-Za-z0-9_-]+)\s*=/gm)].map((match) => match[1]);
  let insideTable = false;
  const kept = existing.split(/\r?\n/).filter((line) => {
    if (/^\s*\[/.test(line)) insideTable = true;
    if (!insideTable && scalarKeys.some((key) => new RegExp(`^\\s*${key}\\s*=`).test(line))) return false;
    return true;
  }).join("\n");
  const inferred = patch.match(/^\s*\[([^\]]+)\]/m)?.[1];
  const withoutNesa = stripTomlTable(kept, tableName ?? inferred ?? "model_providers.nesa").trim();
  return `${withoutNesa ? `${withoutNesa}\n\n` : ""}${patch.trim()}\n`;
}

export function mergeHermesModelYaml(existing: string, patch: string) {
  const kept: string[] = [];
  let inModel = false;
  for (const line of existing.split(/\r?\n/)) {
    if (/^model:\s*$/.test(line)) { inModel = true; kept.push(line); continue; }
    if (inModel && /^\S/.test(line)) inModel = false;
    if (inModel && /^\s{2}(default|provider|base_url|context_length):/.test(line)) continue;
    kept.push(line);
  }
  const patchLines = patch.trim().split(/\r?\n/).slice(1);
  const modelIndex = kept.findIndex((line) => /^model:\s*$/.test(line));
  if (modelIndex < 0) kept.push("model:", ...patchLines);
  else kept.splice(modelIndex + 1, 0, ...patchLines);
  return `${kept.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function stripHermesModelRouting(existing: string) {
  let inModel = false;
  return existing.split(/\r?\n/).filter((line) => {
    if (/^model:\s*$/.test(line)) { inModel = true; return true; }
    if (inModel && /^\S/.test(line)) inModel = false;
    return !(inModel && /^\s{2}(default|provider|base_url|context_length):/.test(line));
  }).join("\n");
}

export function applyCliToolConfigLocal(config: CliToolConfig) {
  if (!config.files.length) {
    return {
      applied: [] as Array<{ path: string; mode: "merge-json" | "merge-toml" | "merge-yaml-model" | "replace" }>,
      skipped: true as const,
      reason: "This tool does not write a local file — use the dashboard instructions / env instead."
    };
  }
  const applied = config.files.map((file) => applyCliConfigFile(file));
  return { applied, skipped: false as const };
}

type ToolStatus = {
  installed: boolean;
  configPresent?: boolean;
  credentialReady?: boolean;
  settingsPath?: string;
  currentBaseUrl?: string;
  /** nesa = points at NesaRouter; other = some custom URL; none = not patched */
  configStatus: "connected" | "other" | "not_configured" | "unsupported";
  settings?: Record<string, unknown> | null;
};

const TOOL_COMMANDS: Partial<Record<CliToolId, string[]>> = {
  "claude-code": ["claude"], codex: ["codex"], "gemini-cli": ["gemini"], "qwen-code": ["qwen"],
  hermes: ["hermes"], openclaw: ["openclaw"], opencode: ["opencode"], amp: ["amp"], droid: ["droid"],
  "deepseek-tui": ["deepseek"], jcode: ["jcode"]
};

function commandInstalled(tool: CliToolId) {
  const commands = TOOL_COMMANDS[tool];
  if (!commands?.length) return false;
  return commands.some((command) => {
    try {
      execFileSync(process.platform === "win32" ? "where.exe" : "which", [command], { stdio: "ignore", timeout: 2000, windowsHide: true });
      return true;
    } catch { return false; }
  });
}

type StatusMeta = {
  path: string;
  baseUrlKeys: string[];
  /** Extra text configs (yaml/toml/env) to scan for a base URL. */
  scanPaths?: string[];
};

const TOOL_STATUS_FILES: Partial<Record<CliToolId, StatusMeta>> = {
  "claude-code": {
    path: "~/.claude/settings.json",
    baseUrlKeys: ["env.ANTHROPIC_BASE_URL"]
  },
  "gemini-cli": {
    path: "~/.gemini/settings.json",
    baseUrlKeys: ["security.auth.baseUrl"]
  },
  "qwen-code": {
    path: "~/.qwen/settings.json",
    baseUrlKeys: []
  },
  openclaw: {
    path: "~/.openclaw/openclaw.json",
    baseUrlKeys: ["models.providers.nesa.baseUrl"]
  },
  continue: {
    path: "~/.continue/config.json",
    baseUrlKeys: []
  },
  hermes: {
    path: "~/.hermes/config.yaml",
    baseUrlKeys: [],
    scanPaths: ["~/.hermes/config.yaml", "~/.hermes/.env"]
  },
  codex: {
    path: "~/.codex/config.toml",
    baseUrlKeys: [],
    scanPaths: ["~/.codex/config.toml"]
  },
  "deepseek-tui": {
    path: "~/.deepseek/config.toml",
    baseUrlKeys: [],
    scanPaths: ["~/.deepseek/config.toml"]
  },
  jcode: {
    path: "~/.jcode/config.toml",
    baseUrlKeys: [],
    scanPaths: ["~/.jcode/config.toml"]
  }
};

const CLAUDE_RESET_ENV = [
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL"
];

const OPENAI_ENV_KEYS = ["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"];

function getByPath(obj: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function looksLikeNesa(url: string, nesaBase?: string) {
  const normalized = url.replace(/\/$/, "").toLowerCase();
  if (normalized.includes("localhost:20129") || normalized.includes("127.0.0.1:20129")) return true;
  if (nesaBase) {
    const host = nesaBase.replace(/\/$/, "").toLowerCase().replace(/^https?:\/\//, "");
    if (host && normalized.includes(host)) return true;
  }
  return normalized.includes("/v1") && (normalized.includes("nesa") || normalized.includes("20129"));
}

/** Pull a base URL out of yaml / toml / env / json text. */
export function extractBaseUrlFromText(raw: string): string | undefined {
  const patterns = [
    /^\s*OPENAI_BASE_URL\s*=\s*["']?([^\s"'#]+)/im,
    /^\s*ANTHROPIC_BASE_URL\s*=\s*["']?([^\s"'#]+)/im,
    /^\s*base_url\s*[:=]\s*["']([^"']+)["']/im,
    /^\s*baseUrl\s*[:=]\s*["']([^"']+)["']/im,
    /"baseUrl"\s*:\s*"([^"]+)"/i,
    /"apiBase"\s*:\s*"([^"]+)"/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

function upsertEnvFile(existing: string, patch: string) {
  const map = new Map<string, string>();
  const order: string[] = [];

  const absorb = (text: string, overwrite: boolean) => {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1);
      if (!overwrite && map.has(key)) continue;
      if (!map.has(key)) order.push(key);
      map.set(key, value);
    }
  };

  absorb(existing, false);
  absorb(patch, true);
  return order.map((key) => `${key}=${map.get(key)}`).join("\n");
}

function stripEnvKeys(content: string, keys: string[]) {
  const drop = new Set(keys);
  return content
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return true;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) return true;
      return !drop.has(trimmed.slice(0, eq).trim());
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/** Remove a TOML table like `[model_providers.nesa]` through the next table header. */
export function stripTomlTable(content: string, header: string) {
  const lines = content.split(/\r?\n/);
  const normalizedHeader = header.trim();
  const kept: string[] = [];
  let dropping = false;

  for (const line of lines) {
    // Only a table header at the start of a line ends the current table.
    // Brackets inside arrays and quoted values are ordinary TOML content.
    const table = line.match(/^\s*\[([^\[\]]+)\]\s*(?:#.*)?$/)?.[1]?.trim();
    if (table) {
      dropping = table === normalizedHeader;
      if (dropping) continue;
    }
    if (!dropping) kept.push(line);
  }

  const result = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return result ? `${result}\n` : "";
}

function continueNesaBaseUrl(settings: Record<string, unknown>): string | undefined {
  const models = settings.models;
  if (!Array.isArray(models)) return undefined;
  for (const entry of models) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const apiBase = typeof row.apiBase === "string" ? row.apiBase : undefined;
    const title = typeof row.title === "string" ? row.title : "";
    if (apiBase && (title.includes("NesaRouter") || looksLikeNesa(apiBase))) return apiBase;
  }
  return undefined;
}

export function readCliToolStatus(tool: CliToolId, nesaBaseUrl?: string): ToolStatus {
  const meta = TOOL_STATUS_FILES[tool];
  const binaryInstalled = commandInstalled(tool);
  if (tool === "gemini-cli" || tool === "continue") {
    return { installed: binaryInstalled, configPresent: false, credentialReady: false, configStatus: "unsupported" };
  }
  if (!meta) {
    return { installed: binaryInstalled, configPresent: false, credentialReady: false, configStatus: "unsupported" };
  }

  const settingsPath = expandCliHomePath(meta.path);
  const scanTargets = (meta.scanPaths ?? [meta.path]).map(expandCliHomePath);
  const configPresent = fs.existsSync(settingsPath) || scanTargets.some((target) => fs.existsSync(target));
  const installed = binaryInstalled;

  if (!fs.existsSync(settingsPath) && !scanTargets.some((target) => fs.existsSync(target))) {
    return { installed, configPresent: false, credentialReady: false, settingsPath, configStatus: "not_configured", settings: null };
  }

  if (!settingsPath.endsWith(".json")) {
    let currentBaseUrl: string | undefined;
    let combined = "";
    for (const target of scanTargets) {
      if (!fs.existsSync(target)) continue;
      const raw = fs.readFileSync(target, "utf8");
      combined += `\n${raw}`;
      currentBaseUrl ??= extractBaseUrlFromText(raw);
    }
    if (!currentBaseUrl) {
      return { installed, configPresent, credentialReady: false, settingsPath, configStatus: "not_configured", settings: null };
    }
    const credentialReady = tool === "hermes"
      ? /^\s*OPENAI_API_KEY\s*=\s*\S+/im.test(combined)
      : tool === "codex"
        ? /^\s*experimental_bearer_token\s*=\s*["'][^"']+["']/im.test(combined) || (
            /^\s*env_key\s*=\s*["']([^"']+)["']/im.test(combined) && Boolean(process.env[combined.match(/^\s*env_key\s*=\s*["']([^"']+)["']/im)?.[1] ?? ""])
          )
        : true;
    return {
      installed,
      configPresent,
      credentialReady,
      settingsPath,
      currentBaseUrl,
      configStatus: looksLikeNesa(currentBaseUrl, nesaBaseUrl) && credentialReady ? "connected" : "other",
      settings: null
    };
  }

  if (!fs.existsSync(settingsPath)) {
    return { installed, configPresent: false, credentialReady: false, settingsPath, configStatus: "not_configured", settings: null };
  }

  const settings = readJsonFile(settingsPath);
  let currentBaseUrl: string | undefined;
  for (const key of meta.baseUrlKeys) {
    const value = getByPath(settings, key);
    if (typeof value === "string" && value.trim()) {
      currentBaseUrl = value.trim();
      break;
    }
  }

  if (tool === "claude-code") {
    const env = (settings.env as Record<string, unknown> | undefined) ?? {};
    currentBaseUrl = typeof env.ANTHROPIC_BASE_URL === "string" ? env.ANTHROPIC_BASE_URL : undefined;
  }

  if (tool === "qwen-code") {
    const providers = getByPath(settings, "modelProviders.openai");
    if (Array.isArray(providers)) {
      const nesa = providers.find((entry) => entry && typeof entry === "object" && (
        (entry as Record<string, unknown>).envKey === "NESA_ROUTER_API_KEY" ||
        (typeof (entry as Record<string, unknown>).baseUrl === "string" && looksLikeNesa(String((entry as Record<string, unknown>).baseUrl), nesaBaseUrl))
      )) as Record<string, unknown> | undefined;
      if (typeof nesa?.baseUrl === "string") currentBaseUrl = nesa.baseUrl;
    }
  }

  if (!currentBaseUrl) {
    return { installed, configPresent, credentialReady: false, settingsPath, configStatus: "not_configured", settings, currentBaseUrl };
  }

  const credentialReady = tool === "openclaw"
    ? typeof getByPath(settings, "models.providers.nesa.apiKey") === "string" && Boolean(String(getByPath(settings, "models.providers.nesa.apiKey")).trim())
    : tool === "claude-code"
      ? typeof getByPath(settings, "env.ANTHROPIC_AUTH_TOKEN") === "string" && Boolean(String(getByPath(settings, "env.ANTHROPIC_AUTH_TOKEN")).trim())
    : tool === "qwen-code"
      ? typeof getByPath(settings, "env.NESA_ROUTER_API_KEY") === "string" && Boolean(String(getByPath(settings, "env.NESA_ROUTER_API_KEY")).trim())
    : true;

  return {
    installed,
    configPresent,
    credentialReady,
    settingsPath,
    currentBaseUrl,
    configStatus: looksLikeNesa(currentBaseUrl, nesaBaseUrl) && credentialReady ? "connected" : "other",
    settings
  };
}

function writeOrRemove(filePath: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

export function resetCliToolConfigLocal(tool: CliToolId, options?: { settingsPath?: string; envPath?: string }) {
  if (tool === "claude-code") {
    const settingsPath = options?.settingsPath ?? expandCliHomePath("~/.claude/settings.json");
    if (!fs.existsSync(settingsPath)) {
      return { ok: true, message: "No Claude settings file to reset." };
    }
    const settings = readJsonFile(settingsPath, true);
    const env = { ...((settings.env as Record<string, unknown> | undefined) ?? {}) };
    for (const key of CLAUDE_RESET_ENV) delete env[key];
    if (Object.keys(env).length === 0) delete settings.env;
    else settings.env = env;
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return { ok: true, message: "Claude settings unpatched (NesaRouter env removed).", path: settingsPath };
  }

  if (tool === "gemini-cli" || tool === "qwen-code") {
    const filePath =
      options?.settingsPath ??
      expandCliHomePath(tool === "gemini-cli" ? "~/.gemini/settings.json" : "~/.qwen/settings.json");
    if (!fs.existsSync(filePath)) return { ok: true, message: "No settings file to reset." };
    const settings = readJsonFile(filePath, true);
    const previousBaseUrl = getByPath(settings, "security.auth.baseUrl");
    const security = (settings.security as Record<string, unknown> | undefined) ?? {};
    const auth = (security.auth as Record<string, unknown> | undefined) ?? {};
    delete auth.apiKey;
    delete auth.baseUrl;
    delete auth.selectedType;
    security.auth = auth;
    settings.security = security;
    if (tool === "qwen-code") {
      const providers = (settings.modelProviders as Record<string, unknown> | undefined) ?? {};
      const openai = Array.isArray(providers.openai) ? providers.openai : [];
      const isNesaProvider = (entry: unknown) => entry && typeof entry === "object" && (
        (entry as Record<string, unknown>).envKey === "NESA_ROUTER_API_KEY" ||
        (typeof (entry as Record<string, unknown>).baseUrl === "string" && looksLikeNesa(String((entry as Record<string, unknown>).baseUrl)))
      );
      const hadNesaProvider = openai.some(isNesaProvider);
      providers.openai = openai.filter((entry) => !isNesaProvider(entry));
      if ((providers.openai as unknown[]).length === 0) delete providers.openai;
      if (Object.keys(providers).length === 0) delete settings.modelProviders;
      else settings.modelProviders = providers;
      const env = (settings.env as Record<string, unknown> | undefined) ?? {};
      delete env.NESA_ROUTER_API_KEY;
      if (Object.keys(env).length === 0) delete settings.env;
      else settings.env = env;
      if (hadNesaProvider) delete settings.model;
    } else if (typeof previousBaseUrl === "string" && looksLikeNesa(previousBaseUrl)) {
      delete settings.model;
    }
    fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return { ok: true, message: "Settings unpatched.", path: filePath };
  }

  if (tool === "openclaw") {
    const filePath = options?.settingsPath ?? expandCliHomePath("~/.openclaw/openclaw.json");
    if (!fs.existsSync(filePath)) return { ok: true, message: "No openclaw.json to reset." };
    const settings = readJsonFile(filePath, true);
    const models = (settings.models as Record<string, unknown> | undefined) ?? {};
    const providers = (models.providers as Record<string, unknown> | undefined) ?? {};
    delete providers.nesa;
    models.providers = providers;
    settings.models = models;
    const agents = (settings.agents as Record<string, unknown> | undefined) ?? {};
    const defaults = (agents.defaults as Record<string, unknown> | undefined) ?? {};
    const model = (defaults.model as Record<string, unknown> | undefined) ?? {};
    if (typeof model.primary === "string" && model.primary.startsWith("nesa/")) delete model.primary;
    if (Object.keys(model).length) defaults.model = model; else delete defaults.model;
    const aliases = (defaults.models as Record<string, unknown> | undefined) ?? {};
    for (const key of Object.keys(aliases)) if (key.startsWith("nesa/")) delete aliases[key];
    if (Object.keys(aliases).length) defaults.models = aliases; else delete defaults.models;
    if (Object.keys(defaults).length) agents.defaults = defaults; else delete agents.defaults;
    if (Object.keys(agents).length) settings.agents = agents; else delete settings.agents;
    fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return { ok: true, message: "Removed NesaRouter provider from OpenClaw.", path: filePath };
  }

  if (tool === "continue") {
    const filePath = options?.settingsPath ?? expandCliHomePath("~/.continue/config.json");
    if (!fs.existsSync(filePath)) return { ok: true, message: "No Continue config to reset." };
    const settings = readJsonFile(filePath, true);
    const models = Array.isArray(settings.models) ? settings.models : [];
    settings.models = models.filter((entry) => {
      if (!entry || typeof entry !== "object") return true;
      const row = entry as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title : "";
      const apiBase = typeof row.apiBase === "string" ? row.apiBase : "";
      if (title.includes("NesaRouter")) return false;
      if (apiBase && looksLikeNesa(apiBase)) return false;
      return true;
    });
    fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return { ok: true, message: "Removed NesaRouter model from Continue.", path: filePath };
  }

  if (tool === "hermes") {
    const yamlPath = options?.settingsPath ?? expandCliHomePath("~/.hermes/config.yaml");
    const envPath = options?.envPath ?? expandCliHomePath("~/.hermes/.env");
    if (fs.existsSync(envPath)) {
      writeOrRemove(envPath, stripEnvKeys(fs.readFileSync(envPath, "utf8"), OPENAI_ENV_KEYS));
    }
    if (fs.existsSync(yamlPath)) {
      const raw = fs.readFileSync(yamlPath, "utf8");
      const next = stripHermesModelRouting(raw);
      writeOrRemove(yamlPath, next);
    }
    return { ok: true, message: "Hermes NesaRouter base URL / OpenAI env removed.", path: yamlPath };
  }

  if (tool === "codex") {
    const filePath = options?.settingsPath ?? expandCliHomePath("~/.codex/config.toml");
    if (!fs.existsSync(filePath)) return { ok: true, message: "No Codex config to reset." };
    const withoutProvider = stripTomlTable(fs.readFileSync(filePath, "utf8"), "model_providers.nesa");
    const next = withoutProvider
      .split(/\r?\n/)
      .filter((line) => !/^\s*model_provider\s*=\s*["']nesa["']\s*$/i.test(line))
      .join("\n");
    writeOrRemove(filePath, next);
    return { ok: true, message: "Removed NesaRouter provider from Codex config.", path: filePath };
  }

  if (tool === "deepseek-tui") {
    const filePath = options?.settingsPath ?? expandCliHomePath("~/.deepseek/config.toml");
    if (!fs.existsSync(filePath)) return { ok: true, message: "No DeepSeek TUI config to reset." };
    writeOrRemove(filePath, stripTomlTable(fs.readFileSync(filePath, "utf8"), "provider"));
    return { ok: true, message: "DeepSeek TUI NesaRouter base URL / key removed.", path: filePath };
  }

  if (tool === "jcode") {
    const filePath = options?.settingsPath ?? expandCliHomePath("~/.jcode/config.toml");
    if (!fs.existsSync(filePath)) return { ok: true, message: "No jcode config to reset." };
    writeOrRemove(filePath, stripTomlTable(fs.readFileSync(filePath, "utf8"), "providers.nesa"));
    return { ok: true, message: "Removed NesaRouter provider from jcode config.", path: filePath };
  }

  return {
    ok: false,
    message: "Automatic reset is not supported for this tool. Remove the NesaRouter block from its config file manually."
  };
}
