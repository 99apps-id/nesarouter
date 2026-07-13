/**
 * Canonical public origin for OAuth redirects, middleware login redirects,
 * and post-auth navigation.
 *
 * Edge-safe: no SQLite / node: imports (middleware bundles this module).
 *
 * Priority:
 * 1. explicit override (e.g. router.publicBaseUrl from a Node caller)
 * 2. NESA_PUBLIC_URL (bracket env access keeps runtime value in standalone)
 * 3. X-Forwarded-Host / Host (when not loopback)
 * 4. request.url origin
 */

function isLoopbackHost(host: string) {
  const hostname = host.replace(/^\[|\]$/g, "").split(":")[0]?.toLowerCase() ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function readEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

export function originFromEnv(value: string | undefined | null) {
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

/** Resolve origin from proxy / Host headers (Edge-safe). */
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
 * Edge-safe public origin (env + headers only).
 * Pass `override` from Node (e.g. dashboard publicBaseUrl) when available.
 */
export function publicOrigin(request?: Request, override?: string | null): string {
  const fromOverride = originFromEnv(override);
  if (fromOverride) return fromOverride;

  const fromEnv = originFromEnv(readEnv("NESA_PUBLIC_URL"));
  if (fromEnv) return fromEnv;

  if (request) return publicOriginFromHeaders(request);

  const port = readEnv("PORT") || "20129";
  return `http://127.0.0.1:${port}`;
}

/** Alias used by middleware — same as publicOrigin (kept for call-site clarity). */
export function publicOriginEdge(request: Request): string {
  return publicOrigin(request);
}

export function publicUrl(pathname: string, request?: Request, override?: string | null): string {
  const base = publicOrigin(request, override);
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, `${base}/`).toString();
}

/** Absolute login redirect for middleware (always uses public origin). */
export function publicLoginRedirectUrl(request: Request, nextPath: string): string {
  const login = new URL("/login", `${publicOrigin(request)}/`);
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
