/**
 * Minimal in-memory rate limiter for admin API routes.
 * Resets on process restart — acceptable for single-node deployments.
 */

interface Bucket {
  windows: number[];  // timestamps in ms
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;  // 1 minute

function prune(bucket: Bucket) {
  const cutoff = Date.now() - WINDOW_MS;
  const remaining = bucket.windows.filter((ts) => ts >= cutoff);
  bucket.windows = remaining;
}

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number = WINDOW_MS,
): { allowed: boolean; remaining: number; resetMs: number } {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { windows: [] };
    buckets.set(key, bucket);
  }
  prune(bucket);

  if (bucket.windows.length >= maxAttempts) {
    const oldest = bucket.windows[0] ?? Date.now();
    return { allowed: false, remaining: 0, resetMs: oldest + windowMs - Date.now() };
  }

  bucket.windows.push(Date.now());
  return { allowed: true, remaining: maxAttempts - bucket.windows.length, resetMs: 0 };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

/** Build a rate-limit key scoped to the caller IP. */
export function rateLimitKey(request: Request, suffix: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || "local";
  return `${ip}:${suffix}`;
}
