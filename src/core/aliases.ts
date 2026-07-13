import type { ProviderConfig } from "@/core/types";

export interface ModelAlias {
  id: string;
  /** Short name clients send as `model` (e.g. "fast"). */
  alias: string;
  /** Target: provider id, provider model, or combo name. */
  target: string;
}

export function resolveModelAlias(aliases: ModelAlias[] | undefined, model: string): string {
  const normalized = model.trim().toLowerCase();
  if (!normalized) return model;
  const hit = (aliases ?? []).find((item) => item.alias.toLowerCase() === normalized);
  return hit?.target ?? model;
}

export function matchesAliasTarget(provider: ProviderConfig, target: string) {
  const normalized = target.toLowerCase();
  return (
    provider.id.toLowerCase() === normalized ||
    provider.model.toLowerCase() === normalized ||
    provider.name.toLowerCase() === normalized ||
    `${provider.id}:${provider.model}`.toLowerCase() === normalized ||
    (Array.isArray(provider.models) && provider.models.some((m) => m.toLowerCase() === normalized))
  );
}
