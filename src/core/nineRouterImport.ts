import type { ModelAlias } from "@/core/aliases";

export interface AliasImportResult {
  added: number;
  updated: number;
  skipped: number;
  aliases: ModelAlias[];
}

function aliasId(alias: string) {
  return alias.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "alias";
}

/**
 * Normalize 9router-style `provider:model` to `provider/model`.
 * Leaves URLs and model ids that already contain `/` alone.
 * Only rewrites when there is exactly one colon and no slash.
 */
export function normalizeNineRouterTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("/")) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  const colon = trimmed.indexOf(":");
  if (colon <= 0 || colon !== trimmed.lastIndexOf(":")) return trimmed;
  const left = trimmed.slice(0, colon).trim();
  const right = trimmed.slice(colon + 1).trim();
  if (!left || !right) return trimmed;
  return `${left}/${right}`;
}

function collectPairs(payload: unknown): Array<{ alias: string; target: string }> {
  if (payload == null) return [];

  if (Array.isArray(payload)) {
    const pairs: Array<{ alias: string; target: string }> = [];
    for (const item of payload) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const alias = typeof row.alias === "string" ? row.alias.trim() : "";
      const target = typeof row.target === "string" ? row.target.trim() : "";
      if (alias && target) pairs.push({ alias, target });
    }
    return pairs;
  }

  if (typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;

  if (root.aliases != null && typeof root.aliases === "object" && !Array.isArray(root.aliases)) {
    return Object.entries(root.aliases as Record<string, unknown>)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([alias, value]) => ({ alias: alias.trim(), target: String(value).trim() }));
  }

  if (Array.isArray(root.aliases)) {
    return collectPairs(root.aliases);
  }

  // Flat map: { "fast": "or/meta-llama/...", ... }
  const entries = Object.entries(root);
  if (
    entries.length > 0 &&
    entries.every(([key, value]) => typeof key === "string" && typeof value === "string")
  ) {
    return entries
      .map(([alias, target]) => ({ alias: alias.trim(), target: String(target).trim() }))
      .filter((item) => item.alias && item.target);
  }

  return [];
}

/**
 * Merge 9router / Nesa alias payloads into the existing ModelAlias list.
 * Case-insensitive alias match; duplicates overwrite target (and keep prior id when present).
 */
export function mergeNineRouterAliases(
  existing: ModelAlias[] | undefined,
  payload: unknown
): AliasImportResult {
  const current = [...(existing ?? [])];
  const pairs = collectPairs(payload);
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const pair of pairs) {
    const alias = pair.alias.trim();
    const target = normalizeNineRouterTarget(pair.target);
    if (!alias || !target) {
      skipped += 1;
      continue;
    }

    const idx = current.findIndex((item) => item.alias.toLowerCase() === alias.toLowerCase());
    if (idx >= 0) {
      if (current[idx].target === target && current[idx].alias === alias) {
        skipped += 1;
        continue;
      }
      current[idx] = { ...current[idx], alias, target };
      updated += 1;
      continue;
    }

    current.push({ id: aliasId(alias), alias, target });
    added += 1;
  }

  return { added, updated, skipped, aliases: current };
}
