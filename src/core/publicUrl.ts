/**
 * Canonical public origin for OAuth redirects, middleware login redirects,
 * and post-auth navigation.
 *
 * Priority:
 * 1. NESA_PUBLIC_URL (Edge-safe; use bracket env access so standalone keeps runtime value)
 * 2. Router setting publicBaseUrl (Node only — skipped on Edge)
 * 3. X-Forwarded-Host / Host (when not loopback — typical reverse proxy)
 * 4. request.url origin
 */

function isLoopbackHost(host: string) {
  const hostname = host.replace(/^\[|\]$/g, "").split(":")[0]?.toLowerCase() ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function readEnv(name: string) {
  // Bracket access avoids build-time inlining of empty values into Edge middleware.
  return process.env[name]?.trim() || undefined;
}

function originFromEnv(value: string | undefined | null) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).origin;
  } catch {
    try {
      return new URL(`https://${trimmed}`).origin;
    } catch {
      return undefined;
    }
  }
}

/** Optional dashboard-configured public URL (Node only; never call from Edge). */
function originFromStore(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readPublicBaseUrlSync } = require("@/lib/store") as typeof import("@/lib/store");
    return originFromEnv(readPublicBaseUrlSync());
  } catch {
    return undefined;
  }
}

function isEdgeRuntime() {
  return typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime === "string";
}

/** Resolve origin from proxy / Host headers (Edge-safe, no SQLite). */
export function publicOriginFromHeaders(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim();
  const candidate = forwardedHost || hostHeader || url.host;
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    ?.replace(/:$/, "");

  if (candidate && !isLoopbackHost(candidate)) {
    const proto =
      forwardedProto ||
      (url.protocol === "https:" ? "https" : undefined) ||
      (!candidate.includes(":") ? "https" : "http");
    return `${proto}://${candidate}`;
  }

  if (forwardedHost) {
    const proto = forwardedProto || url.protocol.replace(":", "") || "http";
    return `${proto}://${forwardedHost}`;
  }

  return url.origin;
}

/**
 * Edge-safe public origin (env + headers only). Use from middleware.
 * Does not read SQLite publicBaseUrl.
 */
export function publicOriginEdge(request: Request): string {
  const fromEnv = originFromEnv(readEnv("NESA_PUBLIC_URL"));
  if (fromEnv) return fromEnv;
  return publicOriginFromHeaders(request);
}

export function publicOrigin(request?: Request): string {
  const fromEnv = originFromEnv(readEnv("NESA_PUBLIC_URL"));
  if (fromEnv) return fromEnv;

  if (!isEdgeRuntime()) {
    const fromStore = originFromStore();
    if (fromStore) return fromStore;
  }

  if (request) return publicOriginFromHeaders(request);

  const port = readEnv("PORT") || "20129";
  return `http://127.0.0.1:${port}`;
}

export function publicUrl(pathname: string, request?: Request): string {
  const base = request ? (isEdgeRuntime() ? publicOriginEdge(request) : publicOrigin(request)) : publicOrigin();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, `${base}/`).toString();
}

/** Absolute login redirect for middleware (always uses public origin). */
export function publicLoginRedirectUrl(request: Request, nextPath: string): string {
  const origin = publicOriginEdge(request);
  const login = new URL("/login", `${origin}/`);
  if (nextPath && nextPath !== "/login") {
    login.searchParams.set("next", nextPath);
  }
  return login.toString();
}

/** Whether Set-Cookie should use the Secure flag (must match the browser scheme). */
export function cookieSecurePreferred(request?: Request): boolean {
  const override = readEnv("NESA_COOKIE_SECURE")?.toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;

  if (request) {
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      ?.replace(/:$/, "")
      .toLowerCase();
    if (forwardedProto === "https") return true;
    if (forwardedProto === "http") return false;

    const forwarded = request.headers.get("forwarded");
    const forwardedMatch = forwarded?.match(/proto=(https?)/i);
    if (forwardedMatch?.[1]) return forwardedMatch[1].toLowerCase() === "https";

    try {
      const proto = new URL(request.url).protocol;
      if (proto === "https:") return true;
      if (proto === "http:") {
        const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
          .split(",")[0]
          ?.trim();
        if (host && !isLoopbackHost(host) && !host.includes(":")) return true;
        if (host && !isLoopbackHost(host)) return false;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    if (originFromEnv(readEnv("NESA_PUBLIC_URL"))?.startsWith("https://")) return true;
  } catch {
    /* ignore */
  }

  return process.env.NODE_ENV === "production";
}
