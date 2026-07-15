import crypto from "node:crypto";

const STICKY_TTL_MS = 30 * 60_000;
const stickySessions = new Map<string, { providerId: string; expiresAt: number }>();

function pruneSticky(now = Date.now()) {
  for (const [key, value] of stickySessions) {
    if (value.expiresAt <= now) stickySessions.delete(key);
  }
}

/** True when the request looks like a mid-agent tool loop (should keep the same provider). */
export function isAgentContinuation(body: any): boolean {
  if (!body || typeof body !== "object") return false;
  if (typeof body.previous_response_id === "string" && body.previous_response_id.trim()) return true;

  const messages = Array.isArray(body.messages) ? body.messages : [];
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    if (message.role === "tool") return true;
    if (message.role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length) return true;
  }

  const input = Array.isArray(body.input) ? body.input : [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const type = String(item.type ?? "");
    if (type.includes("function_call") || type.includes("tool") || type === "item_reference") return true;
  }

  return false;
}

function firstUserBlob(body: any): string {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  for (const message of messages) {
    if (message?.role !== "user") continue;
    if (typeof message.content === "string") return message.content.slice(0, 800);
    if (Array.isArray(message.content)) {
      return message.content
        .map((part: any) => (typeof part?.text === "string" ? part.text : typeof part === "string" ? part : ""))
        .join(" ")
        .slice(0, 800);
    }
  }
  if (typeof body?.input === "string") return body.input.slice(0, 800);
  return "";
}

/**
 * Session key for sticky routing.
 * Prefer explicit client headers/metadata; otherwise hash early user text + model
 * so tool-followups of the same agent turn map together.
 */
export function stickySessionKey(body: any, request?: Request): string | null {
  const headerKey =
    request?.headers.get("x-nesa-session")?.trim() ||
    request?.headers.get("x-nesa-sticky")?.trim() ||
    "";
  if (headerKey) return `hdr:${headerKey.slice(0, 128)}`;

  const meta = body?.metadata;
  if (meta && typeof meta === "object") {
    const fromMeta =
      (typeof meta.nesa_session === "string" && meta.nesa_session.trim()) ||
      (typeof meta.nesa_sticky === "string" && meta.nesa_sticky.trim()) ||
      "";
    if (fromMeta) return `meta:${fromMeta.slice(0, 128)}`;
  }

  if (!isAgentContinuation(body)) return null;

  const model = typeof body?.model === "string" ? body.model.trim().toLowerCase() : "";
  const seed = `${model}\n${firstUserBlob(body)}`;
  if (!seed.trim()) return null;
  const digest = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24);
  return `auto:${digest}`;
}

export function peekStickyProvider(sessionKey: string | null | undefined): string | null {
  if (!sessionKey) return null;
  pruneSticky();
  const hit = stickySessions.get(sessionKey);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    stickySessions.delete(sessionKey);
    return null;
  }
  return hit.providerId;
}

export function rememberStickyProvider(sessionKey: string | null | undefined, providerId: string) {
  if (!sessionKey || !providerId) return;
  pruneSticky();
  stickySessions.set(sessionKey, { providerId, expiresAt: Date.now() + STICKY_TTL_MS });
}

/** Test helper — clears in-memory sticky map. */
export function clearStickySessionsForTests() {
  stickySessions.clear();
}
