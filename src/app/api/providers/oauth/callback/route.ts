import { NextResponse } from "next/server";
import { exchangeCode, loadAntigravityProjectId } from "@/core/oauthPkce";
import { getPreset } from "@/core/oauthProviderPresets";
import { publicUrl } from "@/core/publicUrl";
import { deleteOAuthPending, readOAuthPending, readProviderById, saveProviderOAuthTokens } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(publicUrl(`/providers?oauth_error=${encodeURIComponent(errorParam)}`, request));
  }
  if (!code || !state) {
    return NextResponse.redirect(publicUrl("/providers?oauth_error=missing_code", request));
  }

  const pending = await readOAuthPending(state);
  if (!pending) {
    return NextResponse.redirect(publicUrl("/providers?oauth_error=invalid_state", request));
  }
  await deleteOAuthPending(state);
  const pendingAgeMs = Date.now() - new Date(pending.createdAt).getTime();
  if (pendingAgeMs > 10 * 60_000) {
    return NextResponse.redirect(publicUrl("/providers?oauth_error=state_expired", request));
  }

  const provider = await readProviderById(pending.providerId);
  if (!provider) {
    return NextResponse.redirect(publicUrl("/providers?oauth_error=provider_missing", request));
  }
  const preset = getPreset(provider.oauthProfile);
  if (!preset) {
    return NextResponse.redirect(publicUrl("/providers?oauth_error=no_preset", request));
  }

  try {
    const tokens = await exchangeCode(preset, code, pending.redirectUri, pending.codeVerifier);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined;
    const projectId = preset.profile === "antigravity" && tokens.access_token
      ? await loadAntigravityProjectId(preset, tokens.access_token)
      : undefined;
    await saveProviderOAuthTokens(provider.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      projectId
    }, {
      accountId: pending.accountId,
      createNew: !pending.accountId
    });
    return NextResponse.redirect(publicUrl("/providers?oauth=connected", request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "exchange failed";
    return NextResponse.redirect(publicUrl(`/providers?oauth_error=${encodeURIComponent(message)}`, request));
  }
}
