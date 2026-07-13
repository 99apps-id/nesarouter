import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminCookieName, hasAdminSessionCookieShape } from "@/core/adminSessionCookie";
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
  // Edge middleware cookie parsing was returning false 401s for /api/* while SSR pages worked.
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/v1")) {
    return NextResponse.next();
  }

  if (PUBLIC_PAGES.includes(pathname)) {
    return NextResponse.next();
  }

  const cookieOk = hasAdminSessionCookieShape(sessionCookieValue(request));
  if (!cookieOk && !pathname.startsWith("/login")) {
    return NextResponse.redirect(publicLoginRedirectUrl(request, pathname));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"]
};
