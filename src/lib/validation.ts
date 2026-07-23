/**
 * Zod schemas for API input validation.
 * Drop-in replacement for manual if-checks in route handlers.
 */

import { z } from "zod";

// ── Provider ──

export const ProviderSchema = z.object({
  id: z.string().min(1, "Provider id is required."),
  name: z.string().min(1, "Provider name is required."),
  baseUrl: z.string().url("baseUrl must be a valid URL."),
  model: z.string().min(1, "Model is required."),
  type: z.string().optional(),
  tier: z.enum(["free", "cheap", "balanced", "premium"]).optional(),
  status: z.enum(["active", "disabled", "cooldown"]).optional(),
  priority: z.number().int().min(0).optional(),
  inputCostPerMtok: z.number().min(0).optional(),
  outputCostPerMtok: z.number().min(0).optional(),
});

export type ValidatedProvider = z.infer<typeof ProviderSchema>;

// ── API Key ──

export const AddKeySchema = z.object({
  key: z.string().min(1, "Key is required."),
  quotaLimitTokens: z.number().int().min(0).optional(),
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
