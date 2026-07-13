import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  adminCookieName,
  hasAdminSessionCookieLenientShape,
  isMalformedAdminSessionCookie
} from "@/core/adminSessionCookie";
import { publicLoginRedirectUrl } from "@/core/publicUrl";

const PUBLIC_PAGES = ["/login"];

function sessionCookieValue(request: NextRequest) {
  const fromJar = request.cookies.get(adminCookieName)?.value;
  if (fromJar) return fromJar;
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${adminCookieName}=([^;]*)`));
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1].trim().replace(/^"|"$/g, ""));
  } catch {
    return match[1].trim().replace(/^"|"$/g, "");
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin JSON APIs are gated in Node via requireAdmin (cookies() + DB).
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/v1")) {
    return NextResponse.next();
  }

  if (PUBLIC_PAGES.includes(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = sessionCookieValue(request);
  const cookieOk = hasAdminSessionCookieLenientShape(sessionCookie);
  if (!cookieOk && !pathname.startsWith("/login")) {
    // request.url is the internal upstream URL behind Caddy/Nginx. Resolve the
    // public origin so an unauthenticated visitor never gets sent to localhost.
    const response = NextResponse.redirect(publicLoginRedirectUrl(request, pathname));
    // Only drop cookies that cannot possibly verify (wrong shape). Stale expMs is
    // refreshed by /api/auth/session while the DB session is still valid.
    if (isMalformedAdminSessionCookie(sessionCookie)) {
      response.cookies.set(adminCookieName, "", { path: "/", maxAge: 0 });
    }
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nesa-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"]
};
