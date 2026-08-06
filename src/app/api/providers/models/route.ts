import { NextResponse } from "next/server";
import { adminJson, readAdminJson, requireAdmin } from "@/lib/adminApi";
import { loadProviderWithFreshToken } from "@/core/providerOAuthFlow";
import { listProviderModels } from "@/core/providerClient";
import { ProviderConfig } from "@/core/types";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsedBody = await readAdminJson<{ providerId?: string; provider?: ProviderConfig }>(request);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.data;
  const store = await readStore();
  const savedProvider = body.providerId ? store.providers.find((item) => item.id === body.providerId) : undefined;
  let provider = body.provider
    ? { ...savedProvider, ...body.provider, apiKey: body.provider.apiKey || savedProvider?.apiKey || "" }
    : savedProvider;

  if (!provider) {
    return NextResponse.json({ ok: false, error: "Provider not found." }, { status: 404 });
  }

  if (provider.oauthProfile) {
    const refreshed = await loadProviderWithFreshToken(provider.id);
    if (refreshed) provider = refreshed;
  }

  try {
    const models = await listProviderModels(provider);
    return adminJson(request, { ok: true, models });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load models." },
      { status: 502 }
    );
  }
}
