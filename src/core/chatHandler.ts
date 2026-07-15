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
import { isOAuthAccountFatalError } from "@/core/oauthAccountHealth";
import { applyFreshOAuthToken, clearOAuthAccountCooldown, markOAuthAccountCooldown, pickActiveOAuthAccounts, providerWithFreshOAuthToken, rememberOAuthAccountUse } from "@/core/oauthAccounts";
import { clearKeyCooldown, markKeyCooldown, pickActiveKeys, rememberKeyUse } from "@/core/providerKeys";
import { acquireGate, GateTicket, QueueTimeoutError } from "@/core/requestGate";
import { recordCacheHit, recordError, recordQueueTimeout, recordRequest } from "@/core/runtimeMetrics";
import { peekStickyProvider, rememberStickyProvider, stickySessionKey } from "@/core/stickyRouting";
import { appendUsage, clearProviderCooldown, markProviderFailure, markOAuthAccountConnection, readStore, saveCacheEntry } from "@/lib/store";
import { Combo, NesaStore, ProviderConfig, RouteDecision, UsageLog } from "@/core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function loggedModel(body: any, fallback: string) {
  const requested = typeof body?.model === "string" ? body.model.trim() : "";
  if (!requested) return fallback;
  const normalized = requested.toLowerCase();
  if (normalized === "auto" || normalized === "nesa-auto" || normalized === "nesa/router") return fallback;
  return requested;
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

function gateLimits(store: NesaStore) {
  return {
    maxGlobal: store.router.maxConcurrentUpstream ?? 0,
    maxPerProvider: store.router.maxConcurrentPerProvider ?? 0,
    waitMs: store.router.queueWaitMs ?? 30_000
  };
}

function queueTimeoutResponse(error: QueueTimeoutError) {
  recordQueueTimeout();
  return NextResponse.json(
    { error: { message: error.message, code: "queue_timeout" } },
    { status: 503, headers: { "Retry-After": "5" } }
  );
}

async function revalidateQuotaCooldown(provider: ProviderConfig): Promise<boolean> {
  try {
    if (provider.oauthProfile) {
      const fresh = await ensureFreshAccessToken(provider);
      if (fresh) provider = applyFreshOAuthToken(provider, fresh);
    }
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

  recordRequest();

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
        savedCostUsd: cached.savedCostUsd,
        status: "success"
      };
      await appendUsage(log);
      recordCacheHit();
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

  const response = await runFallbackLoop(store, effectiveBody, key, combo, request);
  if (response.status >= 400) recordError();
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

async function runFallbackLoop(
  store: NesaStore,
  body: any,
  key: string,
  combo: Combo | undefined,
  request?: Request
): Promise<Response> {
  const failedProviderIds: string[] = [];
  const errors: string[] = [];
  const stickyKey = stickySessionKey(body, request);
  const preferProviderId = peekStickyProvider(stickyKey) ?? undefined;

  while (failedProviderIds.length < store.providers.length) {
    let decision: RouteDecision;
    try {
      decision = chooseProvider(store, body, failedProviderIds, combo, { preferProviderId });
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

    let providerFailed = true;
    /** OAuth upstream/account failures must not park the whole provider in cooldown. */
    let oauthCooldownWholeProvider = false;

    if (decision.provider.oauthProfile) {
      const accounts = pickActiveOAuthAccounts(decision.provider);
      if (!accounts.length) {
        failedProviderIds.push(decision.provider.id);
        errors.push(`${decision.provider.name}: OAuth not connected (no active account).`);
        await markProviderFailure(decision.provider.id, "OAuth not connected.", 5 * 60_000);
        if (store.router.fallbackMode === "off") {
          return NextResponse.json({ error: { message: "OAuth not connected.", attempts: errors } }, { status: 502 });
        }
        continue;
      }

      for (const account of accounts) {
        const fresh = await ensureFreshAccessToken(decision.provider, account.id);
        if (!fresh) {
          errors.push(`${decision.provider.name} (${account.name ?? `account ${account.index + 1}`}): OAuth token unavailable.`);
          await markOAuthAccountConnection(
            decision.provider.id,
            account.id,
            false,
            "OAuth token unavailable or refresh failed."
          );
          continue;
        }
        const oauthProvider = providerWithFreshOAuthToken(decision.provider, account, fresh);
        let ticket: GateTicket | undefined;
        try {
          ticket = await acquireGate(decision.provider.id, gateLimits(store));
        } catch (error) {
          if (error instanceof QueueTimeoutError) return queueTimeoutResponse(error);
          throw error;
        }
        try {
          const upstream = await callProvider(oauthProvider, body);
          rememberOAuthAccountUse(decision.provider.id, account.index);
          clearOAuthAccountCooldown(decision.provider.id, account.index);
          await markOAuthAccountConnection(decision.provider.id, account.id, true);
          await clearProviderCooldown(decision.provider.id);
          providerFailed = false;
          rememberStickyProvider(stickyKey, decision.provider.id);

          if (upstream instanceof ReadableStream) {
            return finalizeStream(store, decision, upstream, key, body, ticket);
          }
          try {
            return await finalizeJson(store, decision, upstream, key, body);
          } finally {
            ticket.release();
          }
        } catch (error) {
          ticket.release();
          if (error instanceof UpstreamProviderError) {
            const keyCooldown = keyFailureCooldown(error);
            if (isOAuthAccountFatalError(error)) {
              await markOAuthAccountConnection(decision.provider.id, account.id, false, error.message);
            } else if (keyCooldown) {
              markOAuthAccountCooldown(decision.provider.id, account.index, keyCooldown);
            }
            errors.push(`${decision.provider.name} (${account.name ?? `account ${account.index + 1}`}): ${error.message}`);
            continue;
          }
          errors.push(`${decision.provider.name}: ${error instanceof Error ? error.message : "Unknown error."}`);
          oauthCooldownWholeProvider = true;
          providerFailed = true;
          break;
        }
      }
    } else {
      const keys = pickActiveKeys(decision.provider, store);
      if (keys.length === 0) {
        failedProviderIds.push(decision.provider.id);
        errors.push(`${decision.provider.name}: no active API key (all keys in cooldown or daily quota exhausted).`);
        await markProviderFailure(decision.provider.id, "All API keys unavailable (cooldown/quota).", 5 * 60_000);
        if (store.router.fallbackMode === "off") {
          return NextResponse.json({ error: { message: "All keys in cooldown.", attempts: errors } }, { status: 502 });
        }
        continue;
      }

      for (const picked of keys) {
        let ticket: GateTicket | undefined;
        try {
          ticket = await acquireGate(decision.provider.id, gateLimits(store));
        } catch (error) {
          if (error instanceof QueueTimeoutError) return queueTimeoutResponse(error);
          throw error;
        }
        try {
          const upstream = await callProvider(decision.provider, body, picked.key);
          rememberKeyUse(decision.provider.id, picked.index);
          clearKeyCooldown(decision.provider.id, picked.index);
          await clearProviderCooldown(decision.provider.id);
          providerFailed = false;
          rememberStickyProvider(stickyKey, decision.provider.id);

          if (upstream instanceof ReadableStream) {
            return finalizeStream(store, decision, upstream, key, body, ticket, picked.index);
          }

          try {
            return await finalizeJson(store, decision, upstream, key, body, picked.index);
          } finally {
            ticket.release();
          }
        } catch (error) {
          ticket.release();
          if (error instanceof UpstreamProviderError) {
            const keyCooldown = keyFailureCooldown(error);
            if (keyCooldown) markKeyCooldown(decision.provider.id, picked.index, keyCooldown);
            errors.push(`${decision.provider.name} (key #${picked.index + 1}): ${error.message}`);
            continue;
          }
          errors.push(`${decision.provider.name}: ${error instanceof Error ? error.message : "Unknown error."}`);
          await markProviderFailure(decision.provider.id, error instanceof Error ? error.message : "Unknown error.", 3 * 60_000);
          providerFailed = true;
          break;
        }
      }
    }

    if (providerFailed) {
      failedProviderIds.push(decision.provider.id);
      const lastError = errors[errors.length - 1] ?? `${decision.provider.name} failed.`;
      // Account-scoped OAuth UpstreamProviderError already handled per-account;
      // cooling the whole provider left UI "Connected" while combos skipped it.
      if (!decision.provider.oauthProfile || oauthCooldownWholeProvider) {
        await markProviderFailure(decision.provider.id, lastError.slice(0, 500), 3 * 60_000);
      }
      const log: UsageLog = {
        id: requestId(),
        createdAt: new Date().toISOString(),
        providerId: decision.provider.id,
        providerName: decision.provider.name,
        model: loggedModel(body, decision.provider.model),
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

function skippedProvidersHeader(skipped: RouteDecision["skippedProviders"] | undefined) {
  if (!skipped?.length) return undefined;
  return skipped
    .slice(0, 8)
    .map((item) => `${item.providerId}: ${item.reason}`)
    .join(" | ")
    .slice(0, 700);
}

async function finalizeJson(store: NesaStore, decision: RouteDecision, upstream: any, key: string, body: any, keyIndex?: number) {
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
    model: loggedModel(body, decision.provider.model),
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
    skippedProviders: decision.skippedProviders,
    keyIndex
  };

  if (store.router.cacheEnabled) {
    await saveCacheEntry({
      key,
      createdAt: new Date().toISOString(),
      providerId: decision.provider.id,
      model: loggedModel(body, decision.provider.model),
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
      "x-nesa-cache": log.cacheStatus,
      ...(skippedProvidersHeader(decision.skippedProviders)
        ? { "x-nesa-skipped": skippedProvidersHeader(decision.skippedProviders)! }
        : {})
    }
  });
}

function finalizeStream(
  store: NesaStore,
  decision: RouteDecision,
  upstream: ReadableStream<Uint8Array>,
  key: string,
  body: any,
  ticket?: GateTicket,
  keyIndex?: number
) {
  let capturedUsage: OpenAiUsage | null = null;
  const tracked = trackOpenAiStreamUsage(upstream, (usage) => {
    capturedUsage = usage;
  });

  const baseLog: UsageLog = {
    id: requestId(),
    createdAt: new Date().toISOString(),
    providerId: decision.provider.id,
    providerName: decision.provider.name,
    model: loggedModel(body, decision.provider.model),
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
    skippedProviders: decision.skippedProviders,
    keyIndex
  };

  const finalizeLog = (streamEnd: StreamEndState) => {
    ticket?.release();
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
    if (streamEnd.status !== "success") recordError();
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
        "x-nesa-cost-source": baseLog.costSource,
        ...(skippedProvidersHeader(decision.skippedProviders)
          ? { "x-nesa-skipped": skippedProvidersHeader(decision.skippedProviders)! }
          : {})
      }
    })
  );
}
