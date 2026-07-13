import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { exchangeCode, loadAntigravityProjectId } from "@/core/oauthPkce";
import { getPreset } from "@/core/oauthProviderPresets";
import { deleteOAuthPending, readOAuthPending, readProviderById, saveProviderOAuthTokens } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parse Claude-style `code#state` paste blobs; otherwise use body fields. */
function parsePastedCode(raw: string, fallbackState?: string) {
  const trimmed = raw.trim();
  const hashIdx = trimmed.indexOf("#");
  if (hashIdx > 0) {
    return {
      code: trimmed.slice(0, hashIdx).trim(),
      state: trimmed.slice(hashIdx + 1).trim() || fallbackState
    };
  }
  return { code: trimmed, state: fallbackState };
}

/**
 * POST /api/providers/:id/oauth/complete — finish a manual-code OAuth flow
 * (Claude console callback / Gemini codeassist paste).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { code?: string; state?: string };
  const parsed = parsePastedCode(body.code ?? "", body.state);
  if (!parsed.code || !parsed.state) {
    return NextResponse.json({ error: "Paste the authorization code (and state if separate)." }, { status: 400 });
  }

  const pending = await readOAuthPending(parsed.state);
  if (!pending || pending.providerId !== id) {
    return NextResponse.json({ error: "Invalid or expired OAuth state. Click Connect again." }, { status: 400 });
  }
  const pendingAgeMs = Date.now() - new Date(pending.createdAt).getTime();
  if (pendingAgeMs > 10 * 60_000) {
    await deleteOAuthPending(parsed.state);
    return NextResponse.json({ error: "OAuth state expired. Click Connect again." }, { status: 400 });
  }

  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  const preset = getPreset(provider.oauthProfile);
  if (!preset) return NextResponse.json({ error: "Provider has no OAuth profile." }, { status: 400 });

  try {
    await deleteOAuthPending(parsed.state);
    const tokens = await exchangeCode(preset, parsed.code, pending.redirectUri, pending.codeVerifier, parsed.state);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined;
    const projectId =
      preset.profile === "antigravity" && tokens.access_token
        ? await loadAntigravityProjectId(preset, tokens.access_token)
        : undefined;
    await saveProviderOAuthTokens(provider.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      projectId
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth exchange failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
