import { NextResponse } from "next/server";
import { adminCookieName, adminCookieOptions, adminPasswordMustChange, createAdminSession, timingSafeEqualString } from "@/core/adminAuth";
import { assertOAuthEmailAllowed, enabledOAuthProvider, oauthStateCookieName, resolveOAuthEmail } from "@/core/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const info = enabledOAuthProvider(provider);
  if (!info) return NextResponse.redirect(new URL("/login?error=oauth_not_configured", request.url));

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
    return NextResponse.redirect(new URL("/login?error=oauth_state", request.url));
  }

  try {
    const email = await resolveOAuthEmail(info.id, request, code!);
    assertOAuthEmailAllowed(email);
    const response = NextResponse.redirect(new URL((await adminPasswordMustChange()) ? "/routing" : "/", request.url));
    response.cookies.set(adminCookieName, await createAdminSession(), adminCookieOptions());
    response.cookies.delete(oauthStateCookieName);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth login failed.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
  }
}
