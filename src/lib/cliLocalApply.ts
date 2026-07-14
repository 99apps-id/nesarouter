import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

function readJsonFile(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const stripped = raw.replace(/,(\s*[}\]])/g, "$1");
    const parsed = JSON.parse(stripped);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function applyCliConfigFile(file: CliConfigFile) {
  const target = expandCliHomePath(file.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const mode = file.writeMode ?? (file.path.endsWith(".json") ? "merge-json" : "replace");
  if (mode === "merge-json") {
    let patch: unknown;
    try {
      patch = JSON.parse(file.content);
    } catch {
      throw new Error(`Invalid JSON patch for ${file.path}`);
    }
    const merged = deepMergeJson(readJsonFile(target), patch);
    fs.writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    return { path: target, mode: "merge-json" as const };
  }

  fs.writeFileSync(target, file.content.endsWith("\n") ? file.content : `${file.content}\n`, "utf8");
  return { path: target, mode: "replace" as const };
}

export function applyCliToolConfigLocal(config: CliToolConfig) {
  if (!config.files.length) {
    return {
      applied: [] as Array<{ path: string; mode: "merge-json" | "replace" }>,
      skipped: true as const,
      reason: "This tool does not write a local file — use the dashboard instructions / env instead."
    };
  }
  const applied = config.files.map((file) => applyCliConfigFile(file));
  return { applied, skipped: false as const };
}

type ToolStatus = {
  installed: boolean;
  settingsPath?: string;
  currentBaseUrl?: string;
  /** nesa = points at NesaRouter; other = some custom URL; none = not patched */
  configStatus: "connected" | "other" | "not_configured" | "unsupported";
  settings?: Record<string, unknown> | null;
};

const TOOL_STATUS_FILES: Partial<Record<CliToolId, { path: string; baseUrlKeys: string[] }>> = {
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
    baseUrlKeys: ["security.auth.baseUrl"]
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
    baseUrlKeys: []
  },
  codex: {
    path: "~/.codex/config.toml",
    baseUrlKeys: []
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

function getByPath(obj: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function looksLikeNesa(url: string, nesaBase?: string) {
  const normalized = url.replace(/\/$/, "").toLowerCase();
  if (normalized.includes("localhost:20129") || normalized.includes("127.0.0.1:20129")) return true;
  if (nesaBase && normalized.includes(nesaBase.replace(/\/$/, "").toLowerCase().replace(/^https?:\/\//, ""))) return true;
  return normalized.includes("/v1") && (normalized.includes("nesa") || normalized.includes("20129"));
}

export function readCliToolStatus(tool: CliToolId, nesaBaseUrl?: string): ToolStatus {
  const meta = TOOL_STATUS_FILES[tool];
  if (!meta) {
    return { installed: false, configStatus: "unsupported" };
  }

  const settingsPath = expandCliHomePath(meta.path);
  const installed = fs.existsSync(settingsPath) || fs.existsSync(path.dirname(settingsPath));
  if (!fs.existsSync(settingsPath)) {
    return { installed, settingsPath, configStatus: "not_configured", settings: null };
  }

  if (!settingsPath.endsWith(".json")) {
    return {
      installed: true,
      settingsPath,
      configStatus: "other",
      settings: null
    };
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

  if (!currentBaseUrl) {
    return { installed: true, settingsPath, configStatus: "not_configured", settings, currentBaseUrl };
  }

  return {
    installed: true,
    settingsPath,
    currentBaseUrl,
    configStatus: looksLikeNesa(currentBaseUrl, nesaBaseUrl) ? "connected" : "other",
    settings
  };
}

export function resetCliToolConfigLocal(tool: CliToolId, options?: { settingsPath?: string }) {
  if (tool === "claude-code") {
    const settingsPath = options?.settingsPath ?? expandCliHomePath("~/.claude/settings.json");
    if (!fs.existsSync(settingsPath)) {
      return { ok: true, message: "No Claude settings file to reset." };
    }
    const settings = readJsonFile(settingsPath);
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
    const settings = readJsonFile(filePath);
    const security = (settings.security as Record<string, unknown> | undefined) ?? {};
    const auth = (security.auth as Record<string, unknown> | undefined) ?? {};
    delete auth.apiKey;
    delete auth.baseUrl;
    delete auth.selectedType;
    security.auth = auth;
    settings.security = security;
    fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return { ok: true, message: "Settings unpatched.", path: filePath };
  }

  if (tool === "openclaw") {
    const filePath = options?.settingsPath ?? expandCliHomePath("~/.openclaw/openclaw.json");
    if (!fs.existsSync(filePath)) return { ok: true, message: "No openclaw.json to reset." };
    const settings = readJsonFile(filePath);
    const models = (settings.models as Record<string, unknown> | undefined) ?? {};
    const providers = (models.providers as Record<string, unknown> | undefined) ?? {};
    delete providers.nesa;
    models.providers = providers;
    settings.models = models;
    fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return { ok: true, message: "Removed NesaRouter provider from OpenClaw.", path: filePath };
  }

  return {
    ok: false,
    message: "Automatic reset is not supported for this tool. Remove the NesaRouter block from its config file manually."
  };
}
