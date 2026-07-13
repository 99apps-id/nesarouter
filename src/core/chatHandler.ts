import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { cacheKeyForBody, findCache } from "@/core/cache";
import { estimateCost } from "@/core/estimation";
import { callProvider, testProviderConnection, UpstreamProviderError } from "@/core/providerClient";
import { chooseProvider, findCombo } from "@/core/router";
import { trackOpenAiStreamUsage, withStreamEnd, OpenAiUsage, StreamEndState } from "@/core/streaming";
import { compressToolResults } from "@/core/rtk";
import { injectTokenSaver } from "@/core/tokenSaver";
import { compressWithHeadroom } from "@/core/headroomCompress";
import { compressWithPxpipe } from "@/core/pxpipe";
import { resolveModelAlias } from "@/core/aliases";
import { ensureFreshAccessToken } from "@/core/providerOAuthFlow";
import { clearKeyCooldown, markKeyCooldown, pickActiveKeys, rememberKeyUse } from "@/core/providerKeys";
import { appendUsage, clearProviderCooldown, markProviderFailure, readStore, saveCacheEntry } from "@/lib/store";
import { Combo, NesaStore, ProviderConfig, RouteDecision, UsageLog } from "@/core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isQuotaError(error: UpstreamProviderError) {
  const text = `${error.message} ${error.providerCode ?? ""} ${error.providerType ?? ""}`.toLowerCase();
  return error.status === 429 && /insufficient[_\s-]?quota|quota|billing|exceeded your current quota/.test(text);
}

function keyFailureCooldown(error: UpstreamProviderError) {
  if (isQuotaError(error)) return 60 * 60_000;
  if (error.status === 429) return 10 * 60_000;
  if (error.status >= 500) return 60_000;
  return 0;
}

function quotaCooldownExpired(provider: ProviderConfig): boolean {
  if (provider.status !== "cooldown") return false;
  if (!provider.rateLimitedUntil) return false;
  if (new Date(provider.rateLimitedUntil).getTime() > Date.now()) return false;
  return /quota|billing/i.test(provider.lastError ?? "");
}

async function revalidateQuotaCooldown(provider: ProviderConfig): Promise<boolean> {
  try {
    await testProviderConnection(provider);
    await clearProviderCooldown(provider.id);
    return true;
  } catch {
    await markProviderFailure(provider.id, "Quota re-test failed; staying in cooldown.", 15 * 60_000);
    return false;
  }
}

export interface ChatHandlerResult {
  response: Response;
  /** Resolved combo when the request targeted a combo model. */
  combo?: Combo;
}

/**
 * Core OpenAI-compatible chat completions pipeline. Shared by /v1/chat/completions,
 * /v1/messages (Claude adapter) and /v1/responses (OpenAI Responses adapter).
 * Receives an OpenAI-format body and returns a Response (JSON or SSE in OpenAI
 * format); adapters translate in/out around this.
 */
export async function handleChat(body: any, request: Request): Promise<ChatHandlerResult> {
  const store = await readStore();

  if (!authorizeRequest(store, request)) {
    return { response: NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 }) };
  }

  const combo = findCombo(store, resolveModelAlias(store.aliases, typeof body?.model === "string" ? body.model : ""));

  // Token saver → RTK → Headroom run before cache keying so the cache
  // namespace reflects the active transforms. Headroom is fail-open.
  const aliasedBody = {
    ...body,
    model: resolveModelAlias(store.aliases, typeof body?.model === "string" ? body.model : "")
  };
  const saverApplied = injectTokenSaver(aliasedBody, store.router.tokenSaver);
  const rtkApplied = store.router.rtkEnabled ? compressToolResults(saverApplied) : { body: saverApplied, savedChars: 0 };
  const pxpipeApplied = await compressWithPxpipe(rtkApplied.body, store.router.pxpipeEnabled);
  const headroomApplied = await compressWithHeadroom(pxpipeApplied.body, {
    enabled: store.router.headroomEnabled,
    url: store.router.headroomUrl,
    model: typeof aliasedBody?.model === "string" ? aliasedBody.model : undefined,
    compressUserMessages: store.router.headroomCompressUserMessages
  });
  const effectiveBody = headroomApplied.body;

  const key = cacheKeyForBody(effectiveBody);
  if (store.router.cacheEnabled && !body?.stream) {
    const cached = findCache(store, key);
    if (cached) {
      const log: UsageLog = {
        id: requestId(),
        createdAt: new Date().toISOString(),
        providerId: cached.providerId,
        providerName: "Cache",
        model: cached.model,
        tier: "free",
        taskType: "chat",
        inputTokens: cached.inputTokens,
        outputTokens: cached.outputTokens,
        totalCostUsd: 0,
        costSource: "cached",
        cacheStatus: "hit",
        budgetStatus: "ok",
        routingReason: `Cache hit saved about $${cached.savedCostUsd.toFixed(6)}.`,
        status: "success"
      };
      await appendUsage(log);
      return {
        response: NextResponse.json(cached.response, {
          headers: {
            "x-nesa-cache": "hit",
            "x-nesa-cost-source": "cached",
            "x-nesa-saved-usd": String(cached.savedCostUsd),
            "x-nesa-rtk-saved": String(rtkApplied.savedChars),
            "x-nesa-headroom": headroomApplied.applied ? "applied" : "skipped"
          }
        }),
        combo
      };
    }
  }

  const response = await runFallbackLoop(store, effectiveBody, key, combo);
  if (headroomApplied.applied || rtkApplied.savedChars > 0) {
    const headers = new Headers(response.headers);
    if (rtkApplied.savedChars > 0) headers.set("x-nesa-rtk-saved", String(rtkApplied.savedChars));
    if (headroomApplied.applied) {
      headers.set("x-nesa-headroom", "applied");
      if (headroomApplied.stats?.tokens_saved != null) {
        headers.set("x-nesa-headroom-saved", String(headroomApplied.stats.tokens_saved));
      }
    }
    return {
      response: new Response(response.body, { status: response.status, statusText: response.statusText, headers }),
      combo
    };
  }
  return { response, combo };
}

async function runFallbackLoop(store: NesaStore, body: any, key: string, combo: Combo | undefined): Promise<Response> {
  const failedProviderIds: string[] = [];
  const errors: string[] = [];

  while (failedProviderIds.length < store.providers.length) {
    let decision: RouteDecision;
    try {
      decision = chooseProvider(store, body, failedProviderIds, combo);
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            message: error instanceof Error ? error.message : "Routing failed.",
            attempts: errors
          }
        },
        { status: errors.length ? 502 : 503 }
      );
    }

    if (quotaCooldownExpired(decision.provider)) {
      const ok = await revalidateQuotaCooldown(decision.provider);
      if (!ok) {
        failedProviderIds.push(decision.provider.id);
        errors.push(`${decision.provider.name}: quota re-test failed, still in cooldown.`);
        if (store.router.fallbackMode === "off") {
          return NextResponse.json({ error: { message: "Provider still in quota cooldown.", attempts: errors } }, { status: 502 });
        }
        continue;
      }
    }

    if (decision.provider.oauthProfile) {
      const fresh = await ensureFreshAccessToken(decision.provider);
      if (!fresh) {
        failedProviderIds.push(decision.provider.id);
        errors.push(`${decision.provider.name}: OAuth not connected (no access token).`);
        await markProviderFailure(decision.provider.id, "OAuth not connected.", 5 * 60_000);
        if (store.router.fallbackMode === "off") {
          return NextResponse.json({ error: { message: "OAuth not connected.", attempts: errors } }, { status: 502 });
        }
        continue;
      }
      decision.provider = { ...decision.provider, oauthAccessToken: fresh };
    }

    const keys = pickActiveKeys(decision.provider);
    if (keys.length === 0) {
      failedProviderIds.push(decision.provider.id);
      errors.push(`${decision.provider.name}: no active API key (all keys in cooldown).`);
      await markProviderFailure(decision.provider.id, "All API keys in cooldown.", 5 * 60_000);
      if (store.router.fallbackMode === "off") {
        return NextResponse.json({ error: { message: "All keys in cooldown.", attempts: errors } }, { status: 502 });
      }
      continue;
    }

    let providerFailed = true;
    for (const picked of keys) {
      try {
        const upstream = await callProvider(decision.provider, body, picked.key);
        rememberKeyUse(decision.provider.id, picked.index);
        clearKeyCooldown(decision.provider.id, picked.index);
        await clearProviderCooldown(decision.provider.id);
        providerFailed = false;

        if (upstream instanceof ReadableStream) {
          return finalizeStream(store, decision, upstream, key);
        }

        return finalizeJson(store, decision, upstream, key);
      } catch (error) {
        if (error instanceof UpstreamProviderError) {
          const keyCooldown = keyFailureCooldown(error);
          if (keyCooldown) markKeyCooldown(decision.provider.id, picked.index, keyCooldown);
          errors.push(`${decision.provider.name} (key #${picked.index + 1}): ${error.message}`);
          // try next key for this provider
          continue;
        }
        errors.push(`${decision.provider.name}: ${error instanceof Error ? error.message : "Unknown error."}`);
        await markProviderFailure(decision.provider.id, error instanceof Error ? error.message : "Unknown error.", 3 * 60_000);
        providerFailed = true;
        break;
      }
    }

    if (providerFailed) {
      failedProviderIds.push(decision.provider.id);
      const lastError = errors[errors.length - 1] ?? `${decision.provider.name} failed.`;
      await markProviderFailure(decision.provider.id, lastError.slice(0, 500), 3 * 60_000);
      const log: UsageLog = {
        id: requestId(),
        createdAt: new Date().toISOString(),
        providerId: decision.provider.id,
        providerName: decision.provider.name,
        model: decision.provider.model,
        tier: decision.provider.tier,
        taskType: decision.taskType,
        inputTokens: decision.estimatedInputTokens,
        outputTokens: 0,
        totalCostUsd: 0,
        costSource: "estimated",
        cacheStatus: "miss",
        budgetStatus: decision.budgetStatus,
        routingReason: decision.routingReason,
        status: "error",
        error: lastError,
        skippedProviders: decision.skippedProviders
      };
      await appendUsage(log);
      if (store.router.fallbackMode === "off") {
        return NextResponse.json({ error: { message: log.error, attempts: errors } }, { status: 502 });
      }
    }
  }

  return NextResponse.json({ error: { message: "All fallback providers failed.", attempts: errors } }, { status: 502 });
}

async function finalizeJson(store: NesaStore, decision: RouteDecision, upstream: any, key: string) {
  const usage = upstream?.usage ?? {};
  const inputTokens = Number(usage.prompt_tokens ?? decision.estimatedInputTokens);
  const outputTokens = Number(usage.completion_tokens ?? decision.estimatedOutputTokens);
  const totalCostUsd =
    decision.provider.tier === "free"
      ? 0
      : estimateCost(inputTokens, outputTokens, decision.provider.inputCostPerMTok, decision.provider.outputCostPerMTok);
  const costSource = usage.prompt_tokens || usage.completion_tokens ? "provider_usage" : "estimated";

  const log: UsageLog = {
    id: requestId(),
    createdAt: new Date().toISOString(),
    providerId: decision.provider.id,
    providerName: decision.provider.name,
    model: decision.provider.model,
    tier: decision.provider.tier,
    taskType: decision.taskType,
    inputTokens,
    outputTokens,
    totalCostUsd,
    costSource: decision.provider.tier === "free" ? "free" : costSource,
    cacheStatus: store.router.cacheEnabled ? "miss" : "skipped",
    budgetStatus: decision.budgetStatus,
    routingReason: decision.routingReason,
    status: "success",
    skippedProviders: decision.skippedProviders
  };

  if (store.router.cacheEnabled) {
    await saveCacheEntry({
      key,
      createdAt: new Date().toISOString(),
      providerId: decision.provider.id,
      model: decision.provider.model,
      response: upstream,
      inputTokens,
      outputTokens,
      savedCostUsd: totalCostUsd
    });
  }
  await appendUsage(log);

  return NextResponse.json(upstream, {
    headers: {
      "x-nesa-provider": decision.provider.id,
      "x-nesa-budget-status": decision.budgetStatus,
      "x-nesa-cost-source": log.costSource,
      "x-nesa-cache": log.cacheStatus
    }
  });
}

function finalizeStream(store: NesaStore, decision: RouteDecision, upstream: ReadableStream<Uint8Array>, key: string) {
  let capturedUsage: OpenAiUsage | null = null;
  const tracked = trackOpenAiStreamUsage(upstream, (usage) => {
    capturedUsage = usage;
  });

  const baseLog: UsageLog = {
    id: requestId(),
    createdAt: new Date().toISOString(),
    providerId: decision.provider.id,
    providerName: decision.provider.name,
    model: decision.provider.model,
    tier: decision.provider.tier,
    taskType: decision.taskType,
    inputTokens: decision.estimatedInputTokens,
    outputTokens: decision.estimatedOutputTokens,
    totalCostUsd: decision.provider.tier === "free" ? 0 : decision.estimatedCostUsd,
    costSource: decision.provider.tier === "free" ? "free" : "estimated",
    cacheStatus: "skipped",
    budgetStatus: decision.budgetStatus,
    routingReason: decision.routingReason,
    status: "success",
    skippedProviders: decision.skippedProviders
  };

  const finalizeLog = (streamEnd: StreamEndState) => {
    const inputTokens = capturedUsage?.prompt_tokens ?? baseLog.inputTokens;
    const outputTokens = capturedUsage?.completion_tokens ?? baseLog.outputTokens;
    const totalCostUsd =
      decision.provider.tier === "free"
        ? 0
        : estimateCost(inputTokens, outputTokens, decision.provider.inputCostPerMTok, decision.provider.outputCostPerMTok);
    const costSource = capturedUsage
      ? decision.provider.tier === "free"
        ? "free"
        : "provider_usage"
      : baseLog.costSource;
    const error = streamEnd.status === "error"
      ? streamEnd.error instanceof Error ? streamEnd.error.message : "Upstream stream failed."
      : streamEnd.status === "cancelled"
        ? "Client cancelled stream."
        : undefined;
    appendUsage({
      ...baseLog,
      inputTokens,
      outputTokens,
      totalCostUsd,
      costSource,
      status: streamEnd.status === "success" ? "success" : "error",
      error
    }).catch(() => {});
  };

  const withEnd = withStreamEnd(tracked, finalizeLog);
  return Promise.resolve(
    new Response(withEnd, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-nesa-provider": decision.provider.id,
        "x-nesa-budget-status": decision.budgetStatus,
        "x-nesa-cost-source": baseLog.costSource
      }
    })
  );
}
