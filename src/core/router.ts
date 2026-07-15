import { BudgetSettings, Combo, NesaStore, ProviderConfig, ProviderTier, RouteDecision, TaskType } from "@/core/types";
import { resolveModelAlias } from "@/core/aliases";
import { getBudgetStatus } from "@/core/budget";
import { detectTaskType, estimateCost, estimateOutputTokens, estimateTokens, extractRequestText } from "@/core/estimation";
import { parsePrefixedModel } from "@/core/providerPrefixes";
import { hasRoutableOAuthConnection } from "@/core/oauthAccounts";
import { providerHasCredential } from "@/core/providerCredentials";
import { isProviderRoutingQuotaExhausted, providerRoutingQuotaReason } from "@/core/quota";
import { providerGroup } from "@/lib/providerGroups";

const tierRank: Record<ProviderTier, number> = {
  free: 0,
  cheap: 1,
  balanced: 2,
  premium: 3
};

const taskMaxTier: Record<TaskType, ProviderTier[]> = {
  chat: ["free", "cheap", "balanced", "premium"],
  coding_light: ["free", "cheap", "balanced", "premium"],
  coding_heavy: ["balanced", "premium", "cheap", "free"],
  analysis: ["balanced", "premium", "cheap", "free"]
};

function providerHasKey(provider: ProviderConfig) {
  if (provider.oauthProfile) return hasRoutableOAuthConnection(provider);
  return providerHasCredential(provider);
}

function isProviderUsable(provider: ProviderConfig) {
  const cooldownExpired = provider.status === "cooldown" && provider.rateLimitedUntil && new Date(provider.rateLimitedUntil).getTime() <= Date.now();
  if (provider.status !== "active" && !cooldownExpired) return false;
  if (!providerHasKey(provider)) return false;
  if (provider.rateLimitedUntil && new Date(provider.rateLimitedUntil).getTime() > Date.now()) return false;
  return true;
}

/** UI / combo health — why a provider would be skipped by the router right now. */
export function describeProviderRouteReadiness(provider: ProviderConfig): { ready: boolean; reason: string } {
  if (isProviderUsable(provider)) return { ready: true, reason: "Ready" };
  return { ready: false, reason: providerSkipReason(provider) };
}

function pinPreferredProvider(candidates: ProviderConfig[], preferProviderId?: string) {
  if (!preferProviderId || candidates.length <= 1) return candidates;
  const index = candidates.findIndex((provider) => provider.id === preferProviderId);
  if (index <= 0) return candidates;
  return [candidates[index], ...candidates.slice(0, index), ...candidates.slice(index + 1)];
}

function providerSkipReason(provider: ProviderConfig) {
  const cooldownExpired = provider.status === "cooldown" && provider.rateLimitedUntil && new Date(provider.rateLimitedUntil).getTime() <= Date.now();
  if (provider.status !== "active" && !cooldownExpired) {
    return provider.status === "cooldown"
      ? "Provider in cooldown."
      : "Provider disabled (set Status to Active).";
  }
  if (!providerHasKey(provider)) {
    return provider.oauthProfile
      ? "OAuth not connected or all accounts unusable."
      : "Provider missing API key.";
  }
  if (provider.rateLimitedUntil && new Date(provider.rateLimitedUntil).getTime() > Date.now()) {
    return "Provider in rate-limit cooldown.";
  }
  return "Provider disabled, missing key, or in cooldown.";
}

function sortProviders(providers: ProviderConfig[], mode: NesaStore["router"]["routingMode"], taskType: TaskType) {
  const preferredTiers = taskMaxTier[taskType];
  return [...providers].sort((a, b) => {
    if (mode === "best") return tierRank[b.tier] - tierRank[a.tier] || a.priority - b.priority;
    if (mode === "cheapest" || mode === "free_first") return tierRank[a.tier] - tierRank[b.tier] || a.priority - b.priority;
    return preferredTiers.indexOf(a.tier) - preferredTiers.indexOf(b.tier) || a.priority - b.priority;
  });
}

function rotateRoundRobin(providers: ProviderConfig[], store: NesaStore) {
  if (providers.length <= 1) return providers;
  const latestSuccess = store.usage.find((item) => item.status === "success" && providers.some((provider) => provider.id === item.providerId));
  if (!latestSuccess) return providers;
  const index = providers.findIndex((provider) => provider.id === latestSuccess.providerId);
  if (index < 0) return providers;
  return [...providers.slice(index + 1), ...providers.slice(0, index + 1)];
}

function applyProviderStrategy(providers: ProviderConfig[], store: NesaStore) {
  if (store.router.providerStrategy !== "round_robin") return providers;
  return rotateRoundRobin(providers, store);
}

function applyComboStrategy(providers: ProviderConfig[], store: NesaStore, strategy: Combo["strategy"]) {
  if (strategy === "round_robin") return rotateRoundRobin(providers, store);
  return providers;
}

function requestedModel(body: any) {
  return typeof body?.model === "string" ? body.model.trim() : "";
}

function isAutoModel(model: string) {
  const normalized = model.toLowerCase();
  return !normalized || normalized === "auto" || normalized === "nesa-auto" || normalized === "nesa/router";
}

function matchesRequestedModel(provider: ProviderConfig, model: string) {
  const normalized = model.toLowerCase();
  if (
    provider.id.toLowerCase() === normalized ||
    provider.model.toLowerCase() === normalized ||
    `${provider.id}:${provider.model}`.toLowerCase() === normalized ||
    provider.name.toLowerCase() === normalized
  ) {
    return true;
  }
  if (Array.isArray(provider.models) && provider.models.some((m) => m.toLowerCase() === normalized)) {
    return true;
  }
  return false;
}

function budgetAllowsProvider(settings: BudgetSettings, provider: ProviderConfig, budgetStatus: RouteDecision["budgetStatus"]) {
  const isFreeOrFreeTier = providerGroup(provider) !== "paid";
  if (budgetStatus === "exceeded" && settings.onExceeded === "block_paid") return isFreeOrFreeTier;
  if (budgetStatus === "critical" && settings.onCritical === "free_tier_only") return isFreeOrFreeTier;
  return true;
}

function effectiveRoutingMode(store: NesaStore): NesaStore["router"]["routingMode"] {
  // Explicit manual pin must not be overridden by budget/prefer-free heuristics.
  if (store.router.routingMode === "manual") return "manual";
  const currentBudgetStatus = getBudgetStatus(store);
  if (store.router.preferFreeTier && store.router.routingMode === "auto") return "free_first";
  if (currentBudgetStatus === "warning" && store.budget.onWarning === "prefer_cheaper") return "cheapest";
  if (currentBudgetStatus === "critical" && store.budget.onCritical === "prefer_cheaper") return "cheapest";
  return store.router.routingMode;
}

export function findCombo(store: NesaStore, model: string): Combo | undefined {
  const normalized = model.toLowerCase();
  if (!normalized || isAutoModel(model)) return undefined;
  return (
    store.combos.find((combo) => combo.id.toLowerCase() === normalized) ??
    store.combos.find((combo) => combo.name.toLowerCase() === normalized)
  );
}

export function chooseProvider(
  store: NesaStore,
  body: any,
  excludedProviderIds: string[] = [],
  combo?: Combo,
  options?: { preferProviderId?: string }
): RouteDecision {
  const text = extractRequestText(body);
  const taskType = store.router.evaluatorEnabled === false ? "chat" : detectTaskType(text);
  const estimatedInputTokens = estimateTokens(text || JSON.stringify(body).slice(0, 4000));
  const estimatedOutputTokens = estimateOutputTokens(estimatedInputTokens, taskType);
  const skippedProviders: RouteDecision["skippedProviders"] = [];

  const activeProviders = store.providers.filter((provider) => {
    if (excludedProviderIds.includes(provider.id)) {
      skippedProviders.push({ providerId: provider.id, reason: "Skipped after failed fallback attempt." });
      return false;
    }
    const usable = isProviderUsable(provider);
    if (!usable) {
      skippedProviders.push({ providerId: provider.id, reason: providerSkipReason(provider) });
      return false;
    }
    if (isProviderRoutingQuotaExhausted(provider, store)) {
      skippedProviders.push({ providerId: provider.id, reason: providerRoutingQuotaReason(provider, store) });
      return false;
    }
    return true;
  });

  const mode = effectiveRoutingMode(store);
  const afterAlias = resolveModelAlias(store.aliases, requestedModel(body));
  const prefixed = parsePrefixedModel(afterAlias, store.providers);
  const requested = afterAlias;
  const comboConstraint = combo && combo.providerIds.length ? combo : undefined;

  // Explicit model id → all providers that advertise it (enables cross-provider fallback).
  const modelMatchers = !isAutoModel(requested) && !comboConstraint && !prefixed
    ? store.providers.filter((provider) => matchesRequestedModel(provider, requested))
    : [];

  if (!isAutoModel(requested) && !comboConstraint && !prefixed) {
    if (!modelMatchers.length) {
      throw new Error(`Model '${requested}' is not configured.`);
    }
    const anyUsableLeft = modelMatchers.some((provider) => !excludedProviderIds.includes(provider.id));
    if (!anyUsableLeft) {
      throw new Error(`Model '${requested}' failed on all matching providers.`);
    }
  }

  if (prefixed && !comboConstraint) {
    const exists = store.providers.some((provider) => provider.id === prefixed.providerId);
    if (!exists) {
      throw new Error(`Provider '${prefixed.prefix}' → ${prefixed.providerId} is not configured.`);
    }
    if (excludedProviderIds.includes(prefixed.providerId)) {
      throw new Error(`Model '${afterAlias}' failed.`);
    }
  }

  let candidates: ProviderConfig[];
  if (comboConstraint) {
    const ordered = activeProviders
      .filter((provider) => comboConstraint.providerIds.includes(provider.id))
      .sort((a, b) => comboConstraint.providerIds.indexOf(a.id) - comboConstraint.providerIds.indexOf(b.id));
    candidates = applyComboStrategy(ordered, store, comboConstraint.strategy);
  } else if (prefixed) {
    const hit = activeProviders.find((provider) => provider.id === prefixed.providerId);
    if (!hit) {
      const skipReason = skippedProviders.find((item) => item.providerId === prefixed.providerId)?.reason;
      throw new Error(
        skipReason
          ? `Model '${afterAlias}' is unavailable: ${skipReason}`
          : `Model '${afterAlias}' is not available or its provider is inactive.`
      );
    }
    candidates = [hit];
  } else if (!isAutoModel(requested)) {
    const matches = activeProviders.filter((provider) => matchesRequestedModel(provider, requested));
    if (!matches.length) {
      const skipReason = skippedProviders.find((item) =>
        modelMatchers.some((provider) => provider.id === item.providerId)
      )?.reason;
      throw new Error(
        skipReason
          ? `Model '${requested}' is unavailable: ${skipReason}`
          : `Model '${requested}' is not available or its provider is inactive.`
      );
    }
    candidates = applyProviderStrategy(sortProviders(matches, mode, taskType), store);
  } else {
    const pinManual =
      mode === "manual" && store.router.manualProviderId
        ? activeProviders.find((provider) => provider.id === store.router.manualProviderId)
        : undefined;
    if (mode === "manual" && store.router.manualProviderId && !pinManual) {
      throw new Error(
        `Manual provider '${store.router.manualProviderId}' is not active or has no usable credentials. Activate it under Providers, or pick another Manual provider.`
      );
    }
    candidates = pinManual ? [pinManual] : applyProviderStrategy(sortProviders(activeProviders, mode, taskType), store);
  }

  const stickyAllowed = !comboConstraint || comboConstraint.strategy === "round_robin";
  candidates = stickyAllowed ? pinPreferredProvider(candidates, options?.preferProviderId) : candidates;
  const stickyPinned =
    stickyAllowed && Boolean(options?.preferProviderId) && candidates[0]?.id === options?.preferProviderId;

  for (const provider of candidates) {
    let selectedProvider = provider;
    if (prefixed && provider.id === prefixed.providerId) {
      selectedProvider = { ...provider, model: prefixed.modelId };
    } else if (!isAutoModel(requested) && !comboConstraint) {
      const listed =
        provider.model.toLowerCase() === requested.toLowerCase()
          ? provider.model
          : provider.models?.find((item) => item.toLowerCase() === requested.toLowerCase());
      if (listed) selectedProvider = { ...provider, model: listed };
      else if (
        provider.id.toLowerCase() !== requested.toLowerCase() &&
        provider.name.toLowerCase() !== requested.toLowerCase()
      ) {
        selectedProvider = { ...provider, model: requested };
      }
    }
    const estimatedCostUsd = estimateCost(
      estimatedInputTokens,
      estimatedOutputTokens,
      selectedProvider.inputCostPerMTok,
      selectedProvider.outputCostPerMTok
    );
    const budgetStatus = getBudgetStatus(store, estimatedCostUsd);
    if (!budgetAllowsProvider(store.budget, selectedProvider, budgetStatus)) {
      skippedProviders.push({ providerId: selectedProvider.id, reason: "Skipped by budget guard." });
      continue;
    }

    const stickyPrefix = stickyPinned && selectedProvider.id === options?.preferProviderId ? "Sticky session · " : "";
    return {
      provider: selectedProvider,
      taskType,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd,
      budgetStatus,
      skippedProviders,
      routingReason: stickyPrefix + (comboConstraint
        ? `Combo ${comboConstraint.name} selected ${selectedProvider.name}; budget ${budgetStatus}.`
        : prefixed
          ? `Prefix ${prefixed.prefix}/${prefixed.modelId} selected ${selectedProvider.name}; budget ${budgetStatus}.`
          : !isAutoModel(requested)
            ? `Model ${requested} selected ${selectedProvider.name}; budget ${budgetStatus}.`
            : `${mode}/${store.router.providerStrategy ?? "priority"} selected ${selectedProvider.name} for ${taskType}; budget ${budgetStatus}.`)
    };
  }

  const comboSkip = comboConstraint
    ? skippedProviders.find((item) => comboConstraint.providerIds.includes(item.providerId))?.reason
    : undefined;
  throw new Error(
    comboConstraint
      ? comboSkip
        ? `Combo ${comboConstraint.name} unavailable: ${comboSkip}`
        : `Combo ${comboConstraint.name} has no available provider within budget.`
      : "No active provider is available within the current budget policy."
  );
}
