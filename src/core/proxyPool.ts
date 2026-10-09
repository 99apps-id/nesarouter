import { ProviderConfig } from "@/core/types";
import { UpstreamProviderError, validateProxyUrl } from "@/core/providers/shared";

/**
 * Outbound proxy pool for providers whose entitlement follows the *source
 * address*, not the account.
 *
 * Meta's Muse endpoint is the reference case: one login can list the
 * muse-spark family from a home connection and list only the image models from
 * a datacenter address, so a single server-side IP is not enough. The pool
 * hands each attempt a different egress until one is entitled.
 *
 * Configured through the environment rather than the provider row so proxies
 * (which usually carry credentials) are never written to the database or
 * returned by the admin API:
 *
 *   NESA_MUSE_PROXY_POOL=http://user:pass@host:port,socks5://user:pass@host:port
 *   NESA_PROXY_POOL=...            # fallback for any provider
 *
 * A provider that already sets proxyUrl keeps using it unless a pool is
 * configured, in which case the pool wins (it includes the single proxy as one
 * of its members if you list it there).
 */

export const PROXY_POOL_ENV = "NESA_PROXY_POOL";
export const MUSE_PROXY_POOL_ENV = "NESA_MUSE_PROXY_POOL";

/** A cooling proxy is skipped; short enough that a flaky hop recovers quickly. */
const COOLDOWN_MS = 5 * 60_000;
/** Bounded so a large pool cannot turn one request into a long serial scan. */
export const MAX_PROXY_ATTEMPTS = 4;

/**
 * Upstream wording that means "this egress is not entitled", as opposed to a
 * genuinely malformed request. Kept narrow on purpose: retrying a real 400
 * across the whole pool would multiply the failure by the pool size.
 */
const EGRESS_SIGNAL =
  /does not offer|not offer(ed)?|not available|unavailable|not supported|not enabled|not entitled|no access|region|country|territor|geo|egress|restricted|blocked/i;

/**
 * Parse a pool definition. Accepts comma, semicolon or whitespace separated
 * entries, dedupes, and drops anything that is not a usable proxy URL so a
 * malformed entry cannot be injected into a request. Entries without a scheme
 * are treated as http, which is how operators usually paste `host:port`.
 */
export function parseProxyPool(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const pool: string[] = [];
  for (const candidate of raw.split(/[\s,;]+/)) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : /^[^/]+:\d+$/i.test(trimmed)
        ? `http://${trimmed}`
        : trimmed;
    let normalized = "";
    try {
      normalized = validateProxyUrl(withScheme);
    } catch {
      normalized = "";
    }
    if (!normalized) continue;
    if (!pool.includes(normalized)) pool.push(normalized);
  }
  return pool;
}

/** The pool that applies to a provider: muse first, then the generic pool. */
export function proxyPoolFor(provider: ProviderConfig | undefined | null): string[] {
  const names = provider?.oauthProfile === "muse" ? [MUSE_PROXY_POOL_ENV, PROXY_POOL_ENV] : [PROXY_POOL_ENV];
  for (const name of names) {
    const pool = parseProxyPool(process.env[name]);
    if (pool.length) return pool;
  }
  return [];
}

const stickyByKey = new Map<string, string>();
const cooldownUntil = new Map<string, number>();
const lastUsedAt = new Map<string, number>();

/** Test seam: the pool's health memory is module-scoped by design. */
export function resetProxyPoolState(): void {
  stickyByKey.clear();
  cooldownUntil.clear();
  lastUsedAt.clear();
}

function selectable(pool: string[], tried: Set<string>, now: number): string[] {
  return pool.filter((proxy) => !tried.has(proxy) && (cooldownUntil.get(proxy) ?? 0) <= now);
}

/**
 * Next egress to try. A credential that already worked through a proxy keeps
 * it (the available catalogue is address-dependent, so moving it mid-session
 * can make a working model disappear); otherwise the least-recently-used
 * healthy proxy wins, which spreads concurrent accounts across the pool.
 */
export function selectProxy(pool: string[], key: string, tried: Set<string>): string | undefined {
  const candidates = selectable(pool, tried, Date.now());
  if (!candidates.length) return undefined;
  const pinned = stickyByKey.get(key);
  if (pinned && candidates.includes(pinned)) return pinned;
  let best = candidates[0];
  for (const candidate of candidates) {
    if ((lastUsedAt.get(candidate) ?? 0) < (lastUsedAt.get(best) ?? 0)) best = candidate;
  }
  return best;
}

export function reportProxySuccess(key: string, proxy: string): void {
  stickyByKey.set(key, proxy);
  cooldownUntil.delete(proxy);
  lastUsedAt.set(proxy, Date.now());
}

export function reportProxyFailure(proxy: string): void {
  cooldownUntil.set(proxy, Date.now() + COOLDOWN_MS);
  lastUsedAt.set(proxy, Date.now());
  for (const [key, pinned] of stickyByKey) {
    if (pinned === proxy) stickyByKey.delete(key);
  }
}

/** True when the upstream refused because of the egress, not the request. */
export function looksLikeEgressRestriction(status: number, message: string): boolean {
  // 407 is the proxy rejecting our credentials: a different proxy may work.
  if (status === 407) return true;
  if (![400, 401, 403, 404, 429].includes(status)) return false;
  return EGRESS_SIGNAL.test(message);
}

/**
 * Run `attempt` against pool members until one succeeds. Only egress refusals
 * consume another proxy; any other error is thrown straight through so the
 * caller sees the real failure.
 */
export async function callWithProxyPool<T>(
  provider: ProviderConfig,
  pool: string[],
  attempt: (provider: ProviderConfig) => Promise<T>
): Promise<T> {
  const key = provider.id || provider.name || "default";
  const tried = new Set<string>();
  const limit = Math.min(pool.length, MAX_PROXY_ATTEMPTS);
  let lastError: unknown;

  for (let index = 0; index < limit; index += 1) {
    const proxy = selectProxy(pool, key, tried);
    if (!proxy) break;
    tried.add(proxy);
    const routed: ProviderConfig = { ...provider, proxyUrl: proxy };
    try {
      const answer = await attempt(routed);
      reportProxySuccess(key, proxy);
      return answer;
    } catch (error) {
      const status = error instanceof UpstreamProviderError ? error.status : 0;
      const message = error instanceof Error ? error.message : String(error);
      if (!looksLikeEgressRestriction(status, message)) throw error;
      reportProxyFailure(proxy);
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  throw new UpstreamProviderError(
    `No proxy in the pool is currently healthy (${pool.length} configured, ${tried.size} tried).`,
    502
  );
}
