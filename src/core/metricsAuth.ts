import { timingSafeEqualString } from "@/core/adminSessionCookie";

/**
 * Metrics are deny-by-default. Set NESA_METRICS_TOKEN and pass it via
 * `Authorization: Bearer …` or `?token=`.
 */
export async function authorizeMetrics(
  request: Request,
  tokenEnv = process.env.NESA_METRICS_TOKEN
): Promise<boolean> {
  const required = tokenEnv?.trim();
  if (!required) return false;

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token")?.trim() ?? "";
  if (queryToken && (await timingSafeEqualString(queryToken, required))) return true;

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const bearer = match?.[1]?.trim() ?? "";
  return Boolean(bearer && (await timingSafeEqualString(bearer, required)));
}
