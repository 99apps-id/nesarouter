import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "@/lib/store";

const MIMO_BASE = "https://api.xiaomimimo.com";
const MIMO_SYSTEM_PROMPT =
  "You are MiMoCode, Xiaomi's free coding assistant. Be concise, correct, and prefer actionable code.";

type CachedJwt = { token: string; expiresAt: number };

let memoryCache: CachedJwt | null = null;

function fingerprintPath() {
  return join(getDataDir(), "mimo-free", "client-fingerprint");
}

function jwtCachePath() {
  return join(getDataDir(), "mimo-free", "jwt-cache.json");
}

export function ensureMimoSystemPrompt(messages: any[]): any[] {
  const list = Array.isArray(messages) ? [...messages] : [];
  const has = list.some(
    (message) => message?.role === "system" && String(message?.content ?? "").includes("MiMoCode")
  );
  if (has) return list;
  return [{ role: "system", content: MIMO_SYSTEM_PROMPT }, ...list];
}

export function readOrCreateMimoFingerprint(): string {
  const path = fingerprintPath();
  try {
    const existing = readFileSync(path, "utf8").trim();
    if (existing.length >= 16) return existing;
  } catch {
    /* create */
  }
  mkdirSync(join(getDataDir(), "mimo-free"), { recursive: true });
  const fingerprint = createHash("sha256").update(randomBytes(32)).digest("hex");
  writeFileSync(path, fingerprint, "utf8");
  return fingerprint;
}

function readCachedJwt(): CachedJwt | null {
  if (memoryCache && memoryCache.expiresAt - Date.now() > 60_000) return memoryCache;
  try {
    const raw = JSON.parse(readFileSync(jwtCachePath(), "utf8")) as CachedJwt;
    if (raw?.token && typeof raw.expiresAt === "number" && raw.expiresAt - Date.now() > 60_000) {
      memoryCache = raw;
      return raw;
    }
  } catch {
    /* miss */
  }
  return null;
}

function writeCachedJwt(token: string, expiresAt: number) {
  memoryCache = { token, expiresAt };
  mkdirSync(join(getDataDir(), "mimo-free"), { recursive: true });
  writeFileSync(jwtCachePath(), JSON.stringify(memoryCache), "utf8");
}

/** Mint anonymous JWT for Xiaomi free-ai. Upstream may return 403 illegal_access. */
export async function bootstrapMimoFreeJwt(force = false): Promise<string> {
  if (!force) {
    const cached = readCachedJwt();
    if (cached) return cached.token;
  }

  const fingerprint = readOrCreateMimoFingerprint();
  const response = await fetch(`${MIMO_BASE}/api/free-ai/bootstrap`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "MiMoCode/1.0 NesaRouter",
      "x-mimo-client": "nesa-router"
    },
    body: JSON.stringify({ fingerprint, client: "nesa-router", platform: process.platform })
  });
  const text = await response.text();
  if (!response.ok) {
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.message || parsed?.error?.message || detail;
    } catch {
      /* keep raw */
    }
    throw new Error(
      `MiMo Code Free bootstrap failed (${response.status}): ${detail}. Xiaomi currently blocks anonymous free-ai JWT (illegal_access). Use Xiaomi MiMo PAYG/Token Plan, or OpenCode free mimo-* models.`
    );
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("MiMo Code Free bootstrap returned non-JSON.");
  }
  const token = data?.token || data?.access_token || data?.jwt || data?.data?.token;
  if (!token || typeof token !== "string") {
    throw new Error("MiMo Code Free bootstrap returned no JWT.");
  }
  const expiresIn = Number(data?.expires_in ?? data?.expiresIn ?? 3600);
  writeCachedJwt(token, Date.now() + Math.max(60, expiresIn) * 1000);
  return token;
}

export function mimoFreeChatUrl(baseUrl: string): string {
  const root = baseUrl.replace(/\/$/, "");
  if (/\/openai\/chat$/i.test(root)) return root;
  if (/xiaomimimo\.com/i.test(root)) return `${MIMO_BASE}/api/free-ai/openai/chat`;
  return root;
}

export function mimoFreeHeaders(jwt: string): Record<string, string> {
  return {
    authorization: `Bearer ${jwt}`,
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": "MiMoCode/1.0 NesaRouter",
    "x-mimo-client": "nesa-router"
  };
}
