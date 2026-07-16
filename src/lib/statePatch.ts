const ROUTER_KEYS = new Set([
  "routingMode", "providerStrategy", "fallbackMode", "evaluatorEnabled", "preferFreeTier", "cacheEnabled",
  "manualProviderId", "mediaRouting", "rtkEnabled", "tokenSaver", "headroomEnabled", "headroomUrl",
  "headroomCompressUserMessages", "pxpipeEnabled", "publicBaseUrl", "cliTools", "maxConcurrentUpstream",
  "maxConcurrentPerProvider", "queueWaitMs"
]);

function record(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function httpUrl(value: string, allowEmpty = false) {
  if (allowEmpty && !value.trim()) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

export function validateStatePatch(patch: unknown): string | null {
  if (!record(patch)) return "Request body must be a JSON object.";
  const allowedTop = new Set(["budget", "router", "combos", "aliases", "providers", "localApiKeys"]);
  const unknownTop = Object.keys(patch).find((key) => !allowedTop.has(key));
  if (unknownTop) return `Unknown state field: ${unknownTop}.`;

  if (patch.budget !== undefined) {
    if (!record(patch.budget)) return "budget must be an object.";
    const numeric = ["dailyBudgetUsd", "warningThresholdPercent", "criticalThresholdPercent", "hardLimitPercent"];
    for (const key of numeric) {
      const value = patch.budget[key];
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) return `budget.${key} must be a non-negative number.`;
    }
    for (const key of ["warningThresholdPercent", "criticalThresholdPercent", "hardLimitPercent"]) {
      if (patch.budget[key] !== undefined && patch.budget[key] > 100) return `budget.${key} must not exceed 100.`;
    }
    if (patch.budget.onWarning !== undefined && !["prefer_cheaper", "notify_only"].includes(patch.budget.onWarning)) return "Invalid budget.onWarning.";
    if (patch.budget.onCritical !== undefined && !["free_tier_only", "prefer_cheaper"].includes(patch.budget.onCritical)) return "Invalid budget.onCritical.";
    if (patch.budget.onExceeded !== undefined && !["block_paid", "allow_with_warning"].includes(patch.budget.onExceeded)) return "Invalid budget.onExceeded.";
  }

  if (patch.router !== undefined) {
    if (!record(patch.router)) return "router must be an object.";
    const unknown = Object.keys(patch.router).find((key) => !ROUTER_KEYS.has(key));
    if (unknown) return `Unknown router field: ${unknown}.`;
    for (const key of ["evaluatorEnabled", "preferFreeTier", "cacheEnabled", "rtkEnabled", "headroomEnabled", "headroomCompressUserMessages", "pxpipeEnabled"]) {
      if (patch.router[key] !== undefined && typeof patch.router[key] !== "boolean") return `router.${key} must be boolean.`;
    }
    for (const key of ["maxConcurrentUpstream", "maxConcurrentPerProvider", "queueWaitMs"]) {
      const value = patch.router[key];
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) return `router.${key} must be a non-negative integer.`;
    }
    if (patch.router.routingMode !== undefined && !["auto", "free_first", "cheapest", "best", "manual"].includes(patch.router.routingMode)) return "Invalid router.routingMode.";
    if (patch.router.providerStrategy !== undefined && !["priority", "round_robin"].includes(patch.router.providerStrategy)) return "Invalid router.providerStrategy.";
    if (patch.router.fallbackMode !== undefined && !["auto", "off"].includes(patch.router.fallbackMode)) return "Invalid router.fallbackMode.";
    if (patch.router.headroomUrl !== undefined && (typeof patch.router.headroomUrl !== "string" || !httpUrl(patch.router.headroomUrl))) return "router.headroomUrl must be an HTTP(S) URL.";
    if (patch.router.publicBaseUrl !== undefined && (typeof patch.router.publicBaseUrl !== "string" || !httpUrl(patch.router.publicBaseUrl, true))) return "router.publicBaseUrl must be empty or an HTTP(S) URL.";
    if (patch.router.manualProviderId !== undefined && typeof patch.router.manualProviderId !== "string") return "router.manualProviderId must be a string.";
    if (patch.router.mediaRouting !== undefined) {
      if (!record(patch.router.mediaRouting)) return "router.mediaRouting must be an object.";
      const allowedMedia = new Set(["imagesProviderId", "speechProviderId", "transcriptionsProviderId", "embeddingsProviderId", "searchMode"]);
      if (Object.keys(patch.router.mediaRouting).some((key) => !allowedMedia.has(key))) return "Unknown router.mediaRouting field.";
      if (Object.entries(patch.router.mediaRouting).some(([key, value]) => key !== "searchMode" && value !== undefined && typeof value !== "string")) return "Media provider ids must be strings.";
      if (patch.router.mediaRouting.searchMode !== undefined && patch.router.mediaRouting.searchMode !== "builtin") return "Invalid media search mode.";
    }
    if (patch.router.tokenSaver !== undefined) {
      if (!record(patch.router.tokenSaver)) return "router.tokenSaver must be an object.";
      if (Object.keys(patch.router.tokenSaver).some((key) => !["caveman", "ponytail"].includes(key))) return "Unknown router.tokenSaver field.";
      if (Object.values(patch.router.tokenSaver).some((value) => !["off", "lite", "full", "ultra"].includes(value as string))) return "Invalid token saver level.";
    }
    if (patch.router.cliTools !== undefined) {
      if (!record(patch.router.cliTools)) return "router.cliTools must be an object.";
      for (const config of Object.values(patch.router.cliTools)) {
        if (!record(config) || Object.keys(config).some((key) => key !== "modelTarget") || (config.modelTarget !== undefined && typeof config.modelTarget !== "string")) return "Invalid router.cliTools configuration.";
      }
    }
  }

  if (patch.combos !== undefined) {
    if (!Array.isArray(patch.combos)) return "combos must be an array.";
    for (const combo of patch.combos) {
      if (!record(combo) || !String(combo.id || "").trim() || !String(combo.name || "").trim() ||
        !Array.isArray(combo.providerIds) || combo.providerIds.some((id: unknown) => typeof id !== "string") ||
        !["fallback", "round_robin"].includes(combo.strategy)) return "Each combo must have id, name, providerIds, and a valid strategy.";
    }
  }
  if (patch.aliases !== undefined) {
    if (!Array.isArray(patch.aliases)) return "aliases must be an array.";
    for (const alias of patch.aliases) {
      if (!record(alias) || !String(alias.id || "").trim() || !String(alias.alias || "").trim() || !String(alias.target || "").trim()) return "Each alias must have id, alias, and target.";
    }
  }
  return null;
}
