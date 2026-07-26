import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";
import {
  adminCookieName,
  adminPasswordMustChange,
  refreshAdminSessionCookie,
  resolveVerifiedAdminSessionToken
} from "@/core/adminAuth";
import { readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

const adminSessionContext = new AsyncLocalStorage<{ sessionToken: string }>();
export const DEFAULT_ADMIN_JSON_LIMIT_BYTES = 1024 * 1024;

export type AdminJsonResult<T> =
  | { data: T; response?: never }
  | { data?: never; response: NextResponse };

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

/**
 * Parse an admin JSON request with a hard byte limit for both Content-Length
 * and chunked bodies. Routes get one consistent 400/413 interface.
 */
export async function readAdminJson<T = unknown>(
  request: Request,
  maxBytes = DEFAULT_ADMIN_JSON_LIMIT_BYTES
): Promise<AdminJsonResult<T>> {
  try {
    return { data: await readJsonBodyLimited<T>(request, maxBytes) };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        response: NextResponse.json(
          { error: `Request body exceeds ${Math.ceil(maxBytes / 1024)} KB.` },
          { status: 413 }
        )
      };
    }
    return {
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    };
  }
}
