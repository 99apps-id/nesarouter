import { NextResponse } from "next/server";
import { createOAuthState, enabledOAuthProvider, oauthAuthorizeUrl, oauthCookieOptions, oauthStateCookieName } from "@/core/oauth";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const rl = checkRateLimit(rateLimitKey(request, "oauth-start"), 5);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited. Try again later." }, { status: 429 });
  }

  const { provider } = await params;
  const info = enabledOAuthProvider(provider);
  if (!info) return NextResponse.json({ error: "OAuth provider is not configured." }, { status: 404 });

  const state = createOAuthState(info.id);
  const response = NextResponse.redirect(oauthAuthorizeUrl(info.id, request, state));
  response.cookies.set(oauthStateCookieName, state, oauthCookieOptions(request));
  return response;
}
