import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { buildAuthorizeUrl, generatePkce, generateState } from "@/core/oauthPkce";
import { getPreset } from "@/core/oauthProviderPresets";
import { readProviderById, saveOAuthPending } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFrom(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  const preset = getPreset(provider.oauthProfile);
  if (!preset) return NextResponse.json({ error: "Provider has no OAuth profile." }, { status: 400 });
  if (preset.deviceFlow || preset.kiroDeviceFlow || preset.importTokenFlow) {
    return NextResponse.json({
      error: preset.importTokenFlow
        ? "This provider uses Import token / Auto-import from Cursor IDE."
        : "This provider uses device flow. Call /oauth/device/start instead."
    }, { status: 400 });
  }
  const { verifier, challenge } = generatePkce();
  const state = `${id}:${generateState()}`;
  const redirectUri = `${originFrom(request)}/api/providers/oauth/callback`;
  await saveOAuthPending(state, { providerId: id, codeVerifier: verifier, redirectUri, createdAt: new Date().toISOString() });

  const authorizeUrl = buildAuthorizeUrl(preset, redirectUri, state, challenge);
  return NextResponse.json({ authorizeUrl, state });
}
