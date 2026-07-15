import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { chooseProvider } from "@/core/router";
import { baseUrl, cleanApiKey, openRouterHeaders, proxyFetch } from "@/core/providers/shared";
import { applyFreshOAuthToken } from "@/core/oauthAccounts";
import { ensureFreshAccessToken } from "@/core/providerOAuthFlow";
import { pickActiveKeys } from "@/core/providerKeys";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const store = await readStore();
  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  }

  let decision;
  try {
    decision = chooseProvider(store, { model: "auto", messages: [{ role: "user", content: "voices" }] });
  } catch (error) {
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "No provider." } }, { status: 503 });
  }

  if (decision.provider.type !== "openai_compatible") {
    return NextResponse.json({
      object: "list",
      data: [
        { id: "alloy", name: "alloy" },
        { id: "echo", name: "echo" },
        { id: "fable", name: "fable" },
        { id: "onyx", name: "onyx" },
        { id: "nova", name: "nova" },
        { id: "shimmer", name: "shimmer" }
      ]
    });
  }

  let provider = decision.provider;
  if (provider.oauthProfile) {
    const fresh = await ensureFreshAccessToken(provider);
    if (fresh) provider = applyFreshOAuthToken(provider, fresh);
  }
  const keys = pickActiveKeys(provider, store);
  if (!keys.length) {
    return NextResponse.json({ error: { message: "No active API key." } }, { status: 502 });
  }

  try {
    const response = await proxyFetch(provider, `${baseUrl(provider)}/audio/voices`, {
      method: "GET",
      headers: { authorization: `Bearer ${cleanApiKey(keys[0].key)}`, ...openRouterHeaders(provider) }
    });
    if (response.ok) return NextResponse.json(await response.json(), { headers: { "x-nesa-provider": provider.id } });
  } catch {}

  return NextResponse.json({
    object: "list",
    data: [
      { id: "alloy", name: "alloy" },
      { id: "echo", name: "echo" },
      { id: "fable", name: "fable" },
      { id: "onyx", name: "onyx" },
      { id: "nova", name: "nova" },
      { id: "shimmer", name: "shimmer" }
    ]
  });
}
