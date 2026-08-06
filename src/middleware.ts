import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  adminCookieName,
  hasAdminSessionCookieLenientShape,
  isMalformedAdminSessionCookie
} from "@/core/adminSessionCookie";
import {
  accountCookieName,
  hasAccountSessionCookieLenientShape,
  isMalformedAccountSessionCookie
} from "@/core/saas/saasCustomerSessionCookie";
import { publicLoginRedirectUrl, publicOrigin } from "@/core/publicUrl";

/** Public marketing + admin login + customer login / invite redeem. */
const PUBLIC_PAGES = ["/", "/login", "/account/login", "/account/invite"];

function sessionCookieValue(request: NextRequest, name: string) {
  const fromJar = request.cookies.get(name)?.value;
  if (fromJar) return fromJar;
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1].trim().replace(/^"|"$/g, ""));
  } catch {
    return match[1].trim().replace(/^"|"$/g, "");
  }
}

function publicAccountLoginRedirectUrl(request: NextRequest, nextPath: string) {
  const login = new URL("/account/login", `${publicOrigin(request)}/`);
  if (nextPath && nextPath !== "/account/login") {
    login.searchParams.set("next", nextPath);
  }
  return login.toString();
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin JSON APIs are gated in Node via requireAdmin (cookies() + DB).
  // Customer APIs under /api/account/* gate themselves.
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/v1")) {
    return NextResponse.next();
  }

  if (PUBLIC_PAGES.includes(pathname)) {
    return NextResponse.next();
  }

  // Public developer docs (no session).
  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return NextResponse.next();
  }

  // Customer portal — separate session from admin.
  if (pathname === "/account" || pathname.startsWith("/account/")) {
    const accountCookie = sessionCookieValue(request, accountCookieName);
    if (!hasAccountSessionCookieLenientShape(accountCookie)) {
      const response = NextResponse.redirect(publicAccountLoginRedirectUrl(request, pathname));
      if (isMalformedAccountSessionCookie(accountCookie)) {
        response.cookies.set(accountCookieName, "", { path: "/", maxAge: 0 });
      }
      return response;
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nesa-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const sessionCookie = sessionCookieValue(request, adminCookieName);
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
  // Static brand assets + web app manifest must stay public (no login redirect).
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|webmanifest)$).*)"]
};
