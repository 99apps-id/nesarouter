import { NextResponse } from "next/server";
import { adminCookieName, adminCookieOptions, adminPasswordMustChange, createAdminSession, timingSafeEqualString } from "@/core/adminAuth";
import { assertOAuthEmailAllowed, enabledOAuthProvider, oauthStateCookieName, resolveOAuthEmail } from "@/core/oauth";
import { publicUrl } from "@/core/publicUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const info = enabledOAuthProvider(provider);
  if (!info) return NextResponse.redirect(publicUrl("/login?error=oauth_not_configured", request));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const cookieState = request.headers.get("cookie")?.match(new RegExp(`${oauthStateCookieName}=([^;]+)`))?.[1] ?? "";
  const decodedCookieState = cookieState ? decodeURIComponent(cookieState) : "";
  const stateOk =
    Boolean(code) &&
    Boolean(state) &&
    (await timingSafeEqualString(state, decodedCookieState)) &&
    state.startsWith(`${info.id}:`);
  if (!stateOk) {
    return NextResponse.redirect(publicUrl("/login?error=oauth_state", request));
  }

  try {
    const email = await resolveOAuthEmail(info.id, request, code!);
    assertOAuthEmailAllowed(email);
    const nextPath = (await adminPasswordMustChange()) ? "/routing" : "/";
    const response = NextResponse.redirect(publicUrl(nextPath, request));
    response.cookies.set(adminCookieName, await createAdminSession(), adminCookieOptions(request));
    response.cookies.delete(oauthStateCookieName);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth login failed.";
    return NextResponse.redirect(publicUrl(`/login?error=${encodeURIComponent(message)}`, request));
  }
}
