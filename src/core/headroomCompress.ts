import { DEFAULT_HEADROOM_URL } from "@/lib/headroom/detect";

const DEFAULT_TIMEOUT_MS = 3000;

export interface HeadroomCompressOptions {
  enabled?: boolean;
  url?: string;
  model?: string;
  compressUserMessages?: boolean;
  timeoutMs?: number;
}

export interface HeadroomCompressStats {
  tokens_before?: number;
  tokens_after?: number;
  tokens_saved?: number;
  messages: unknown[];
  reason?: string;
}

export interface HeadroomCompressResult {
  body: any;
  stats: HeadroomCompressStats | null;
  applied: boolean;
}

export function buildCompressEndpoint(url: string) {
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname.replace(/\/$/, "") || "";
    if (/\/v1\/compress$/i.test(pathname)) {
      /* already final */
    } else if (/\/v1$/i.test(pathname)) {
      pathname = `${pathname}/compress`;
    } else {
      pathname = `${pathname}/v1/compress`;
    }
    parsed.pathname = pathname;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    const raw = String(url).replace(/#.*$/, "");
    const [base, query = ""] = raw.split("?", 2);
    let endpoint = base.replace(/\/$/, "");
    if (/\/v1\/compress$/i.test(endpoint)) {
      /* ok */
    } else if (/\/v1$/i.test(endpoint)) {
      endpoint = `${endpoint}/compress`;
    } else {
      endpoint = `${endpoint}/v1/compress`;
    }
    return query ? `${endpoint}?${query}` : endpoint;
  }
}

async function callCompress(
  url: string,
  messages: unknown[],
  model: string | undefined,
  timeoutMs: number,
  compressUserMessages: boolean
): Promise<HeadroomCompressStats | null> {
  const endpoint = buildCompressEndpoint(url);
  const payload: Record<string, unknown> = { messages, model };
  if (compressUserMessages) payload.config = { compress_user_messages: true };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as HeadroomCompressStats | null;
  if (!data || !Array.isArray(data.messages)) return null;
  return data;
}

/**
 * Compress OpenAI-format chat body via Headroom `/v1/compress`.
 * Fail-open: returns the original body unchanged on any error / when disabled.
 * Mutates a shallow clone so callers can keep the original request intact.
 */
export async function compressWithHeadroom(body: any, options: HeadroomCompressOptions = {}): Promise<HeadroomCompressResult> {
  const enabled = Boolean(options.enabled);
  const url = options.url || DEFAULT_HEADROOM_URL;
  if (!enabled) return { body, stats: null, applied: false };
  if (!body || typeof body !== "object") return { body, stats: null, applied: false };

  const key = Array.isArray(body.messages) ? "messages" : Array.isArray(body.input) ? "input" : null;
  if (!key) return { body, stats: null, applied: false };

  try {
    const data = await callCompress(
      url,
      body[key],
      options.model ?? (typeof body.model === "string" ? body.model : undefined),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      Boolean(options.compressUserMessages)
    );
    if (!data) return { body, stats: null, applied: false };
    return {
      body: { ...body, [key]: data.messages },
      stats: data,
      applied: true
    };
  } catch {
    return { body, stats: null, applied: false };
  }
}

export function formatHeadroomLog(stats: HeadroomCompressStats | null): string | null {
  if (!stats) return null;
  const before = stats.tokens_before || 0;
  const after = stats.tokens_after || 0;
  const delta = stats.tokens_saved || 0;
  const pct = before > 0 ? ((delta / before) * 100).toFixed(1) : "0";
  return `reported token delta=${delta} before=${before}${after ? ` after=${after}` : ""} (${pct}%)`;
}
