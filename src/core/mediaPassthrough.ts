import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { isOAuthAccountFatalError } from "@/core/oauthAccountHealth";
import { configuredOAuthAccounts, hasOAuthConnection, hasRoutableOAuthConnection, pickActiveOAuthAccounts, providerForOAuthAccount, rememberOAuthAccountUse, clearOAuthAccountCooldown } from "@/core/oauthAccounts";
import { ensureFreshAccessToken } from "@/core/providerOAuthFlow";
import { clearKeyCooldown, markKeyCooldown, pickActiveKeys, rememberKeyUse } from "@/core/providerKeys";
import { baseUrl, cleanApiKey, openRouterHeaders, proxyFetch, upstreamError, UpstreamProviderError } from "@/core/providers/shared";
import { chooseMediaProvider } from "@/core/mediaRouting";
import { ProviderConfig, RouteDecision } from "@/core/types";
import { appendUsage, clearProviderCooldown, markProviderFailure, markOAuthAccountConnection, readStore } from "@/lib/store";
import { estimateCost } from "@/core/estimation";
import { UsageLog } from "@/core/types";

function mediaRequestId() {
  return `media_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export type MediaKind = "embeddings" | "images" | "speech" | "transcriptions";

function pathFor(kind: MediaKind) {
  switch (kind) {
    case "embeddings":
      return "/embeddings";
    case "images":
      return "/images/generations";
    case "speech":
      return "/audio/speech";
    case "transcriptions":
      return "/audio/transcriptions";
  }
}

async function resolveProvider(provider: ProviderConfig, accountId?: string): Promise<ProviderConfig | null> {
  if (!provider.oauthProfile) return provider;
  const account = accountId
    ? configuredOAuthAccounts(provider).find((item) => item.id === accountId)
    : pickActiveOAuthAccounts(provider)[0];
  if (!account) return null;
  const fresh = await ensureFreshAccessToken(provider, account.id);
  if (!fresh) return null;
  return { ...providerForOAuthAccount(provider, account), oauthAccessToken: fresh };
}

/**
 * Shared OpenAI-compatible media passthrough with routing, OAuth refresh, and multi-key.
 */
export async function handleMediaPassthrough(
  request: Request,
  kind: MediaKind,
  options: {
    body: any | FormData;
    isFormData?: boolean;
    probeText: string;
    binaryResponse?: boolean;
  }
): Promise<Response> {
  const store = await readStore();
  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  }

  const modelHint =
    options.isFormData && options.body instanceof FormData
      ? String(options.body.get("model") || "auto")
      : typeof (options.body as any)?.model === "string"
        ? (options.body as any).model
        : "auto";

  let decision: RouteDecision;
  try {
    decision = chooseMediaProvider(store, kind, {
      model: modelHint,
      probeText: options.probeText
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "No provider available." } },
      { status: 503 }
    );
  }

  if (decision.provider.type !== "openai_compatible") {
    return NextResponse.json(
      { error: { message: `${kind} require an OpenAI-compatible provider.` } },
      { status: 400 }
    );
  }

  const url = `${baseUrl(decision.provider)}${pathFor(kind)}`;
  const errors: string[] = [];

  if (decision.provider.oauthProfile) {
    const accounts = pickActiveOAuthAccounts(decision.provider);
    if (!accounts.length) {
      await markProviderFailure(decision.provider.id, "OAuth not connected.", 5 * 60_000);
      return NextResponse.json({ error: { message: "OAuth not connected.", provider: decision.provider.name } }, { status: 502 });
    }
    for (const account of accounts) {
      const provider = await resolveProvider(decision.provider, account.id);
      if (!provider?.oauthAccessToken) continue;
      try {
        const headers: Record<string, string> = {
          authorization: `Bearer ${cleanApiKey(provider.oauthAccessToken)}`,
          ...openRouterHeaders(provider)
        };
        const init = buildMediaInit(kind, options, provider, headers);
        const response = await proxyFetch(provider, url, init);
        if (!response.ok) throw await upstreamError(provider, response);
        rememberOAuthAccountUse(provider.id, account.index);
        clearOAuthAccountCooldown(provider.id, account.index);
        await markOAuthAccountConnection(provider.id, account.id, true);
        await clearProviderCooldown(provider.id);
        return await finishMediaResponse(response, provider, decision, kind, options, modelHint);
      } catch (error) {
        if (error instanceof UpstreamProviderError && isOAuthAccountFatalError(error)) {
          await markOAuthAccountConnection(provider.id, account.id, false, error.message);
        }
        errors.push(error instanceof Error ? error.message : "Media request failed.");
      }
    }
    await markProviderFailure(decision.provider.id, errors.join(" | ").slice(0, 500), 3 * 60_000);
    return NextResponse.json({ error: { message: errors[errors.length - 1] ?? "OAuth media failed." } }, { status: 502 });
  }

  const provider = decision.provider;
  const keys = pickActiveKeys(provider);
  if (!keys.length) {
    await markProviderFailure(provider.id, "All API keys in cooldown.", 5 * 60_000);
    return NextResponse.json({ error: { message: "All keys in cooldown.", provider: provider.name } }, { status: 502 });
  }

  for (const picked of keys) {
    try {
      const headers: Record<string, string> = {
        authorization: `Bearer ${cleanApiKey(picked.key)}`,
        ...openRouterHeaders(provider)
      };
      const init = buildMediaInit(kind, options, provider, headers);
      const response = await proxyFetch(provider, url, init);
      if (!response.ok) throw await upstreamError(provider, response);

      rememberKeyUse(provider.id, picked.index);
      clearKeyCooldown(provider.id, picked.index);
      await clearProviderCooldown(provider.id);
      return await finishMediaResponse(response, provider, decision, kind, options, modelHint);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${kind} upstream failed.`;
      errors.push(`${provider.name}[${picked.index}]: ${message}`);
      const status = typeof (error as any)?.status === "number" ? (error as any).status : 502;
      if (status === 429) markKeyCooldown(provider.id, picked.index, 10 * 60_000);
      else if (status >= 500) markKeyCooldown(provider.id, picked.index, 60_000);
    }
  }

  await markProviderFailure(provider.id, errors.join(" | ").slice(0, 500), 3 * 60_000);
  return NextResponse.json(
    { error: { message: errors[errors.length - 1] || `${kind} upstream failed.`, provider: provider.name, attempts: errors } },
    { status: 502 }
  );
}

function buildMediaInit(kind: MediaKind, options: { body: any | FormData; isFormData?: boolean }, provider: ProviderConfig, headers: Record<string, string>): RequestInit {
  if (options.isFormData && options.body instanceof FormData) {
    return { method: "POST", headers, body: options.body };
  }
  const jsonBody =
    kind === "embeddings" || kind === "images"
      ? { ...(options.body as object), model: (options.body as any)?.model ?? provider.model }
      : options.body;
  return { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(jsonBody) };
}

async function finishMediaResponse(
  response: Response,
  provider: ProviderConfig,
  decision: RouteDecision,
  kind: MediaKind,
  options: { body: any | FormData; isFormData?: boolean; binaryResponse?: boolean },
  modelHint: string
) {
  const requestedModel =
    options.isFormData && options.body instanceof FormData
      ? String(options.body.get("model") || modelHint)
      : typeof (options.body as any)?.model === "string"
        ? (options.body as any).model
        : provider.model;

  const usageLog: UsageLog = {
    id: mediaRequestId(),
    createdAt: new Date().toISOString(),
    providerId: provider.id,
    providerName: provider.name,
    model: requestedModel,
    tier: provider.tier,
    taskType: kind === "embeddings" ? "analysis" : "chat",
    inputTokens: kind === "embeddings" ? 0 : decision.estimatedInputTokens,
    outputTokens: kind === "images" ? 0 : decision.estimatedOutputTokens,
    totalCostUsd:
      provider.tier === "free"
        ? 0
        : estimateCost(
            decision.estimatedInputTokens,
            decision.estimatedOutputTokens,
            provider.inputCostPerMTok,
            provider.outputCostPerMTok
          ),
    costSource: provider.tier === "free" ? "free" : "estimated",
    cacheStatus: "skipped",
    budgetStatus: decision.budgetStatus,
    routingReason: `${kind} via ${provider.name}`,
    status: "success"
  };
  await appendUsage(usageLog);

  const outHeaders = {
    "x-nesa-provider": provider.id,
    "x-nesa-budget-status": decision.budgetStatus
  };

  if (options.binaryResponse) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...outHeaders,
        "content-type": response.headers.get("content-type") || "application/octet-stream"
      }
    });
  }

  const payload = await response.json();
  return NextResponse.json(payload, { headers: outHeaders });
}
