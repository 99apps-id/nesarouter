import crypto from "node:crypto";
import { NesaStore } from "@/core/types";
import { readStore } from "@/lib/store";

function constantTimeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // still do a compare to keep timing roughly uniform
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export function authorizeRequest(store: NesaStore, request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  // Never allow /v1 when no keys are configured — empty list means lockout, not open.
  if (!store.localApiKeys.length) return false;
  if (!token) return false;
  return store.localApiKeys.some((candidate) => constantTimeEquals(token, candidate));
}

export async function authorizeClientRequest(request: Request) {
  return authorizeRequest(await readStore(), request);
}

export function isRequestBodyTooLarge(request: Request, maxBytes = 16 * 1024 * 1024) {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > maxBytes;
}

export class RequestBodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(
      maxBytes >= 1024 * 1024
        ? `Request body exceeds ${Math.floor(maxBytes / (1024 * 1024))} MB.`
        : `Request body exceeds ${Math.max(1, Math.floor(maxBytes / 1024))} KB.`
    );
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * Read a byte stream with an enforced limit. Shared by request bodies and by
 * upstream responses (a hostile or broken upstream must not be able to hand us
 * an unbounded JSON document).
 */
export async function readStreamBounded(
  stream: ReadableStream<Uint8Array> | null | undefined,
  maxBytes: number
): Promise<Uint8Array<ArrayBuffer>> {
  if (!stream) return new Uint8Array(new ArrayBuffer(0));

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  const combined = new Uint8Array(new ArrayBuffer(bytes));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

/**
 * Read the whole body with an enforced byte limit. Like `readJsonBodyLimited`
 * this counts real bytes, so a `Transfer-Encoding: chunked` upload without a
 * Content-Length cannot slip past the limit.
 */
export async function readBodyBytesLimited(
  request: Request,
  maxBytes: number
): Promise<Uint8Array<ArrayBuffer>> {
  if (isRequestBodyTooLarge(request, maxBytes)) throw new RequestBodyTooLargeError(maxBytes);
  return readStreamBounded(request.body, maxBytes);
}

/** Read JSON with an enforced byte limit, including chunked bodies without Content-Length. */
export async function readJsonBodyLimited<T = unknown>(
  request: Request,
  maxBytes = 16 * 1024 * 1024
): Promise<T> {
  if (isRequestBodyTooLarge(request, maxBytes)) throw new RequestBodyTooLargeError(maxBytes);
  if (!request.body) return JSON.parse("") as T;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError(maxBytes);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as T;
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}
