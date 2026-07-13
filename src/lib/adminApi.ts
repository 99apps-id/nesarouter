import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";
import {
  adminCookieName,
  adminPasswordMustChange,
  refreshAdminSessionCookie,
  resolveVerifiedAdminSessionToken
} from "@/core/adminAuth";

const adminSessionContext = new AsyncLocalStorage<{ sessionToken: string }>();

function verifiedSessionToken() {
  return adminSessionContext.getStore()?.sessionToken;
}

/**
 * Admin gate for dashboard APIs. While the bootstrap password is still in use,
 * only allowDuringMustChange routes (password / session / logout) may proceed.
 */
export async function requireAdmin(
  request: Request,
  options?: { allowDuringMustChange?: boolean }
): Promise<NextResponse | null> {
  const sessionToken = await resolveVerifiedAdminSessionToken(request);
  if (!sessionToken) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }
  if (!options?.allowDuringMustChange && (await adminPasswordMustChange())) {
    return NextResponse.json(
      {
        error: "Change the default admin password before continuing.",
        mustChangePassword: true
      },
      { status: 403 }
    );
  }
  adminSessionContext.enterWith({ sessionToken });
  return null;
}

/** Extend the sliding admin session cookie on successful dashboard API responses. */
export async function finalizeAdminResponse(response: NextResponse, request: Request) {
  const sessionToken = verifiedSessionToken() ?? (await resolveVerifiedAdminSessionToken(request));
  if (!sessionToken) return response;
  const refreshed = await refreshAdminSessionCookie(sessionToken, request);
  if (refreshed) response.cookies.set(adminCookieName, refreshed.value, refreshed.options);
  return response;
}

/** JSON response helper that also slides the admin session cookie. */
export async function adminJson(request: Request, body: unknown, init?: ResponseInit) {
  return finalizeAdminResponse(NextResponse.json(body, init), request);
}
