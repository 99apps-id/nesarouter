import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { ensureOauthLoopback } from "@/core/oauthLoopback";
import { buildAuthorizeUrl, generatePkce, generateState } from "@/core/oauthPkce";
import { getPreset, usesOAuthDeviceFlow } from "@/core/oauthProviderPresets";
import { publicOrigin, publicUrl } from "@/core/publicUrl";
import { readProviderById, readPublicBaseUrlSync, saveOAuthPending } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { accountId?: string; createNew?: boolean };
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  const preset = getPreset(provider.oauthProfile);
  if (!preset) return NextResponse.json({ error: "Provider has no OAuth profile." }, { status: 400 });
  if (usesOAuthDeviceFlow(preset) || preset.importTokenFlow) {
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
    let loopbackReady = true;
    try {
      await ensureOauthLoopback(preset.loopbackPort, preset.loopbackPath, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start OAuth loopback listener.";
      const busy = /already in use|EADDRINUSE/i.test(message);
      if (!busy) {
        return NextResponse.json({ error: message }, { status: 500 });
      }
      loopbackReady = false;
    }

    await saveOAuthPending(state, {
      providerId: id,
      accountId: body.createNew ? undefined : body.accountId,
      codeVerifier: verifier,
      redirectUri,
      createdAt: new Date().toISOString()
    });

    const authorizeUrl = buildAuthorizeUrl(preset, redirectUri, state, challenge);
    return NextResponse.json({
      authorizeUrl,
      state,
      createNew: Boolean(body.createNew),
      manualCode: Boolean(preset.manualCodeFlow),
      loopback: loopbackReady,
      loopbackUnavailable: !loopbackReady,
      tokenInCallback: Boolean(preset.tokenInCallback),
      returnUrl: publicUrl("/providers", request, publicBase),
      hint: !loopbackReady
        ? `Port ${preset.loopbackPort} is busy — paste-only mode. After authorize, copy the FULL localhost callback URL (…?code=…&state=…) and paste it here.`
        : preset.manualCodeFlow
          ? "Authorize in the new tab, copy the code shown there, and paste it back here."
          : preset.tokenInCallback
            ? "Authorize in the browser. Kimchi redirects to localhost with ?token=… — connection completes when the loopback captures it."
            : `After redirect to http://localhost:${preset.loopbackPort}${preset.loopbackPath}, connection may complete automatically. If not, paste the FULL URL including query params.`
    });
  }

  await saveOAuthPending(state, {
    providerId: id,
    accountId: body.createNew ? undefined : body.accountId,
    codeVerifier: verifier,
    redirectUri,
    createdAt: new Date().toISOString()
  });

  const authorizeUrl = buildAuthorizeUrl(preset, redirectUri, state, challenge);
  return NextResponse.json({
    authorizeUrl,
    state,
    createNew: Boolean(body.createNew),
    manualCode: Boolean(preset.manualCodeFlow),
    loopback: false,
    tokenInCallback: Boolean(preset.tokenInCallback),
    returnUrl: publicUrl("/providers", request, publicBase),
    hint: preset.manualCodeFlow
      ? "Authorize in the new tab, copy the code shown there, and paste it back here."
      : preset.tokenInCallback
        ? "Authorize in the browser. Kimchi redirects to localhost with ?token=… — connection completes when the loopback captures it."
        : "Authorize in the new tab. If a code or callback URL is shown, paste it here."
  });
}
