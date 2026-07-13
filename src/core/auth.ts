import crypto from "node:crypto";
import { NesaStore } from "@/core/types";

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
