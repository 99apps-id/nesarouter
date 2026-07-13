import { BudgetSettings, Combo, NesaStore, ProviderConfig, ProviderTier, RouteDecision, TaskType } from "@/core/types";
import { resolveModelAlias } from "@/core/aliases";
import { getBudgetStatus } from "@/core/budget";
import { detectTaskType, estimateCost, estimateOutputTokens, estimateTokens, extractRequestText } from "@/core/estimation";
import { parsePrefixedModel } from "@/core/providerPrefixes";
import { hasRoutableOAuthConnection } from "@/core/oauthAccounts";
import { providerHasCredential } from "@/core/providerCredentials";
import { getProviderQuotaState, providerQuotaReason } from "@/core/quota";
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
  const currentBudgetStatus = getBudgetStatus(store);
  if (store.router.preferFreeTier && store.router.routingMode === "auto") return "free_first";
  if (currentBudgetStatus === "warning" && store.budget.onWarning === "prefer_cheaper") return "cheapest";
  if (currentBudgetStatus === "critical" && store.budget.onCritical === "prefer_cheaper") return "cheapest";
  return store.router.routingMode;
}

export function findCombo(store: NesaStore, model: string): Combo | undefined {
  const normalized = model.toLowerCase();
  if (!normalized || isAutoModel(model)) return undefined;
  return store.combos.find((combo) => combo.name.toLowerCase() === normalized || combo.id.toLowerCase() === normalized);
}

export function chooseProvider(
  store: NesaStore,
  body: any,
  excludedProviderIds: string[] = [],
  combo?: Combo
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
      skippedProviders.push({ providerId: provider.id, reason: "Provider disabled, missing key, or in cooldown." });
      return false;
    }
    const quota = getProviderQuotaState(provider, store);
    if (quota?.exhausted) {
      skippedProviders.push({ providerId: provider.id, reason: providerQuotaReason(quota) });
      return false;
    }
    return true;
  });

  const mode = effectiveRoutingMode(store);
  const afterAlias = resolveModelAlias(store.aliases, requestedModel(body));
  const prefixed = parsePrefixedModel(afterAlias, store.providers);
  const model = prefixed ? prefixed.providerId : afterAlias;
  const comboConstraint = combo && combo.providerIds.length ? combo : undefined;

  const requestedProviderAny = !isAutoModel(model) && !comboConstraint
    ? store.providers.find((provider) =>
        prefixed ? provider.id === prefixed.providerId : matchesRequestedModel(provider, model)
      )
    : undefined;

  if (!isAutoModel(model) && !comboConstraint) {
    if (!requestedProviderAny) {
      throw new Error(
        prefixed
          ? `Provider '${prefixed.prefix}' → ${prefixed.providerId} is not configured.`
          : `Model '${model}' is not configured.`
      );
    }
    if (excludedProviderIds.includes(requestedProviderAny.id)) throw new Error(`Model '${afterAlias || model}' failed.`);
  }

  const requestedProvider = requestedProviderAny
    ? activeProviders.find((provider) => provider.id === requestedProviderAny.id)
    : undefined;

  if (!isAutoModel(model) && !comboConstraint && !requestedProvider) {
    const skipReason = skippedProviders.find((item) => item.providerId === requestedProviderAny?.id)?.reason;
    throw new Error(
      skipReason
        ? `Model '${afterAlias || model}' is unavailable: ${skipReason}`
        : `Model '${afterAlias || model}' is not available or its provider is inactive.`
    );
  }

  let candidates: ProviderConfig[];
  if (comboConstraint) {
    const ordered = activeProviders
      .filter((provider) => comboConstraint.providerIds.includes(provider.id))
      .sort((a, b) => comboConstraint.providerIds.indexOf(a.id) - comboConstraint.providerIds.indexOf(b.id));
    candidates = applyComboStrategy(ordered, store, comboConstraint.strategy);
  } else {
    const manual = requestedProvider ?? (store.router.manualProviderId
      ? activeProviders.find((provider) => provider.id === store.router.manualProviderId)
      : undefined);
    candidates = manual ? [manual] : applyProviderStrategy(sortProviders(activeProviders, mode, taskType), store);
  }

  for (const provider of candidates) {
    const selectedProvider =
      prefixed && provider.id === prefixed.providerId ? { ...provider, model: prefixed.modelId } : provider;
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

    return {
      provider: selectedProvider,
      taskType,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd,
      budgetStatus,
      skippedProviders,
      routingReason: comboConstraint
        ? `Combo ${comboConstraint.name} selected ${selectedProvider.name}; budget ${budgetStatus}.`
        : requestedProvider
          ? prefixed
            ? `Prefix ${prefixed.prefix}/${prefixed.modelId} selected ${selectedProvider.name}; budget ${budgetStatus}.`
            : `Model ${model} selected ${selectedProvider.name}; budget ${budgetStatus}.`
          : `${mode}/${store.router.providerStrategy ?? "priority"} selected ${selectedProvider.name} for ${taskType}; budget ${budgetStatus}.`
    };
  }

  throw new Error(comboConstraint ? `Combo ${comboConstraint.name} has no available provider within budget.` : "No active provider is available within the current budget policy.");
}
