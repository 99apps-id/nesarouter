/**
 * Zod schemas for API input validation.
 * Drop-in replacement for manual if-checks in route handlers.
 */

import { z } from "zod";
import type { ProviderConfig } from "@/core/types";

const providerTypeSchema = z.enum([
  "openai_compatible",
  "gemini",
  "gemini_cli",
  "anthropic_messages",
  "openai_responses",
  "github_copilot",
  "kiro",
  "opencode",
  "cursor",
  "vertex",
  "grok_web",
]);

const oauthProfileSchema = z.enum([
  "anthropic_claude",
  "openai_codex",
  "gemini_cli",
  "github_copilot",
  "kiro",
  "antigravity",
  "cursor",
  "qwen_code",
  "grok_cli",
  "kimchi",
  "iflow",
  "codebuddy_cn",
  "cline",
  "kilocode",
]);

/** Coerce number inputs from the dashboard; blank/NaN → undefined. */
function optionalFiniteNumber(min = 0) {
  return z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().min(min).optional());
}

function optionalInt(min = 0) {
  return z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }, z.number().int().min(min).optional());
}

// ── Provider ──
// Unknown keys are stripped (Zod default). Do not use passthrough — that would
// allow mass-assignment of secrets (apiKey, oauth tokens) via POST /api/providers.

export const ProviderSchema = z.object({
  id: z.string().min(1, "Provider id is required."),
  name: z.string().min(1, "Provider name is required."),
  baseUrl: z
    .string()
    .trim()
    .min(1, "baseUrl is required.")
    .refine((value) => {
      try {
        const url = new URL(value);
        return Boolean(url.protocol && url.host);
      } catch {
        return false;
      }
    }, "baseUrl must be a valid URL."),
  model: z.string().min(1, "Model is required."),
  type: providerTypeSchema.optional(),
  tier: z.enum(["free", "cheap", "balanced", "premium"]).optional(),
  status: z.enum(["active", "disabled", "cooldown"]).optional(),
  priority: optionalInt(0),
  // Dashboard sends inputCostPerMTok (capital T); keep legacy lowercase alias.
  inputCostPerMTok: optionalFiniteNumber(0),
  outputCostPerMTok: optionalFiniteNumber(0),
  inputCostPerMtok: optionalFiniteNumber(0),
  outputCostPerMtok: optionalFiniteNumber(0),
  models: z.array(z.string().min(1)).optional(),
  supportsTools: z.boolean().optional(),
  quotaLimitTokens: optionalInt(0),
  proxyUrl: z.preprocess(
    (value) => (value === null || value === undefined ? undefined : String(value).trim()),
    z
      .union([
        z.literal(""),
        z.string().refine((value) => {
          try {
            return Boolean(new URL(value).protocol);
          } catch {
            return false;
          }
        }, "proxyUrl must be a valid URL.")
      ])
      .optional()
  ),
  oauthProfile: oauthProfileSchema.optional(),
});

export type ValidatedProvider = z.infer<typeof ProviderSchema>;

/** Map validated provider fields into a store-safe ProviderConfig (no secrets from body). */
export function toProviderConfig(data: ValidatedProvider): ProviderConfig {
  const inputCost = data.inputCostPerMTok ?? data.inputCostPerMtok ?? 0;
  const outputCost = data.outputCostPerMTok ?? data.outputCostPerMtok ?? 0;
  // Omit apiKey so updateProvider preserves any existing encrypted key.
  return {
    id: data.id.trim(),
    name: data.name.trim(),
    type: data.type ?? "openai_compatible",
    tier: data.tier ?? "balanced",
    status: data.status ?? "disabled",
    baseUrl: data.baseUrl.trim(),
    model: data.model.trim(),
    models: data.models,
    supportsTools: data.supportsTools,
    priority: data.priority ?? 50,
    inputCostPerMTok: inputCost,
    outputCostPerMTok: outputCost,
    quotaLimitTokens: data.quotaLimitTokens,
    proxyUrl: data.proxyUrl || undefined,
    oauthProfile: data.oauthProfile,
  } as ProviderConfig;
}

// ── API Key ──

export const AddKeySchema = z.object({
  key: z.string().min(1, "Key is required."),
  quotaLimitTokens: optionalInt(0),
});

export type ValidatedAddKey = z.infer<typeof AddKeySchema>;

export const DeleteKeySchema = z.object({
  id: z.string().optional(),
  token: z.string().optional(),
}).refine((data) => data.id || data.token, {
  message: "Either id or token is required.",
});

// ── Combo ──

export const ComboSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  providerIds: z.array(z.string().min(1)).min(1, "At least one provider is required."),
  strategy: z.enum(["fallback", "round_robin"]).optional(),
});

// ── MCP Server ──

export const McpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

// ── Delete Provider ──

export const DeleteProviderSchema = z.object({
  id: z.string().min(1, "Provider id is required."),
});
