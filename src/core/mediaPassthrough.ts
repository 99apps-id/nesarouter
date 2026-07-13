import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { ensureFreshAccessToken } from "@/core/providerOAuthFlow";
import { clearKeyCooldown, markKeyCooldown, pickActiveKeys, rememberKeyUse } from "@/core/providerKeys";
import { baseUrl, cleanApiKey, openRouterHeaders, proxyFetch, upstreamError } from "@/core/providers/shared";
import { chooseMediaProvider } from "@/core/mediaRouting";
import { ProviderConfig, RouteDecision } from "@/core/types";
import { appendUsage, clearProviderCooldown, markProviderFailure, readStore } from "@/lib/store";
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

async function resolveProvider(provider: ProviderConfig): Promise<ProviderConfig | null> {
  if (!provider.oauthProfile) return provider;
  const fresh = await ensureFreshAccessToken(provider);
  if (!fresh) return null;
  return { ...provider, oauthAccessToken: fresh };
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

  const provider = await resolveProvider(decision.provider);
  if (!provider) {
    await markProviderFailure(decision.provider.id, "OAuth not connected.", 5 * 60_000);
    return NextResponse.json({ error: { message: "OAuth not connected.", provider: decision.provider.name } }, { status: 502 });
  }

  const keys = pickActiveKeys(provider);
  if (!keys.length) {
    await markProviderFailure(provider.id, "All API keys in cooldown.", 5 * 60_000);
    return NextResponse.json({ error: { message: "All keys in cooldown.", provider: provider.name } }, { status: 502 });
  }

  const url = `${baseUrl(provider)}${pathFor(kind)}`;
  const errors: string[] = [];

  for (const picked of keys) {
    try {
      const headers: Record<string, string> = {
        authorization: `Bearer ${cleanApiKey(picked.key)}`,
        ...openRouterHeaders(provider)
      };

      let init: RequestInit;
      if (options.isFormData && options.body instanceof FormData) {
        init = { method: "POST", headers, body: options.body };
      } else {
        const jsonBody =
          kind === "embeddings" || kind === "images"
            ? { ...(options.body as object), model: (options.body as any)?.model ?? provider.model }
            : options.body;
        headers["content-type"] = "application/json";
        init = { method: "POST", headers, body: JSON.stringify(jsonBody) };
      }

      const response = await proxyFetch(provider, url, init);
      if (!response.ok) throw await upstreamError(provider, response);

      rememberKeyUse(provider.id, picked.index);
      clearKeyCooldown(provider.id, picked.index);
      await clearProviderCooldown(provider.id);

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
