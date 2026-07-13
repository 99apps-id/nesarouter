/**
 * Canonical public origin for OAuth redirects and post-auth navigation.
 *
 * Priority:
 * 1. NESA_PUBLIC_URL
 * 2. Router setting publicBaseUrl (dashboard)
 * 3. X-Forwarded-Host / Host (when not loopback — typical reverse proxy)
 * 4. request.url origin
 */

function isLoopbackHost(host: string) {
  const hostname = host.replace(/^\[|\]$/g, "").split(":")[0]?.toLowerCase() ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
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

/** Optional dashboard-configured public URL (lazy to avoid hard Edge deps). */
function originFromStore(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readPublicBaseUrlSync } = require("@/lib/store") as typeof import("@/lib/store");
    return originFromEnv(readPublicBaseUrlSync());
  } catch {
    return undefined;
  }
}

export function publicOrigin(request?: Request): string {
  const fromEnv = originFromEnv(process.env.NESA_PUBLIC_URL);
  if (fromEnv) return fromEnv;

  const fromStore = originFromStore();
  if (fromStore) return fromStore;

  if (request) {
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
        // Public hostnames behind TLS terminators usually omit x-forwarded-proto
        // when misconfigured; prefer https for bare domains without an explicit port.
        (!candidate.includes(":") ? "https" : "http");
      return `${proto}://${candidate}`;
    }

    if (forwardedHost) {
      const proto = forwardedProto || url.protocol.replace(":", "") || "http";
      return `${proto}://${forwardedHost}`;
    }

    return url.origin;
  }

  const port = process.env.PORT?.trim() || "20129";
  return `http://127.0.0.1:${port}`;
}

export function publicUrl(pathname: string, request?: Request): string {
  const base = publicOrigin(request);
  return new URL(pathname.startsWith("/") ? pathname : `/${pathname}`, `${base}/`).toString();
}

/** Whether Set-Cookie should use the Secure flag. */
export function cookieSecurePreferred(request?: Request): boolean {
  const override = process.env.NESA_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;
  try {
    if (publicOrigin(request).startsWith("https://")) return true;
  } catch {
    /* ignore */
  }
  return process.env.NODE_ENV === "production";
}
