import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminCookieName, hasAdminSessionCookieShape } from "@/core/adminSessionCookie";

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/auth/oauth",
  "/api/providers/oauth/callback",
  "/api/tags"
];

const PUBLIC_PAGES = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Shape-only here: HMAC needs NESA_ENCRYPTION_KEY which Edge middleware often
  // does not see at runtime after image builds. Node handlers still verify fully.
  const cookieOk = hasAdminSessionCookieShape(request.cookies.get(adminCookieName)?.value);

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.next();
    }
    if (!cookieOk) {
      return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/v1")) {
    return NextResponse.next();
  }

  if (PUBLIC_PAGES.includes(pathname)) {
    return NextResponse.next();
  }

  if (!cookieOk && !pathname.startsWith("/login")) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"]
};
