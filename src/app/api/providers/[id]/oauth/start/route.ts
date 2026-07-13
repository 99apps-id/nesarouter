import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { ensureOauthLoopback } from "@/core/oauthLoopback";
import { buildAuthorizeUrl, generatePkce, generateState } from "@/core/oauthPkce";
import { getPreset } from "@/core/oauthProviderPresets";
import { publicOrigin, publicUrl } from "@/core/publicUrl";
import { readProviderById, readPublicBaseUrlSync, saveOAuthPending } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const publicBase = readPublicBaseUrlSync();
  const { verifier, challenge } = generatePkce();
  const state = `${id}:${generateState()}`;
  const redirectUri =
    preset.fixedRedirectUri ?? `${publicOrigin(request, publicBase)}/api/providers/oauth/callback`;

  if (preset.loopbackPort && preset.loopbackPath) {
    try {
      await ensureOauthLoopback(preset.loopbackPort, preset.loopbackPath, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start OAuth loopback listener.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  await saveOAuthPending(state, {
    providerId: id,
    codeVerifier: verifier,
    redirectUri,
    createdAt: new Date().toISOString()
  });

  const authorizeUrl = buildAuthorizeUrl(preset, redirectUri, state, challenge);
  return NextResponse.json({
    authorizeUrl,
    state,
    manualCode: Boolean(preset.manualCodeFlow),
    loopback: Boolean(preset.loopbackPort),
    returnUrl: publicUrl("/providers", request, publicBase),
    hint: preset.manualCodeFlow
      ? "Authorize in the new tab, copy the code shown there, and paste it back here."
      : preset.loopbackPort
        ? `After ChatGPT redirects to http://localhost:${preset.loopbackPort}${preset.loopbackPath} (the page may fail to load), copy the FULL URL from the address bar — including ?code=…&state=… — paste it below, then Save. Same flow as 9router.`
        : "Authorize in the new tab. If a code or callback URL is shown, paste it here."
  });
}
