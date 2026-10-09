import { sanitizeOAuthErrorBody } from "@/core/oauthPkce";
import crypto from "node:crypto";

/**
 * Meta Muse Code key mint.
 *
 * Muse's device grant yields a durable "dca:" token that the model endpoint
 * rejects. The token must be exchanged for an LLM API key, and Meta gates that
 * exchange on the caller looking like the official Muse CLI (user agent, client
 * headers, api version) — hence the identity constants below rather than the
 * NesaRouter user agent.
 */

export const MUSE_DEFAULT_MINT_URL = "https://api.meta.ai/muse-code/key";
export const MUSE_MINT_USER_AGENT =
  "muse-build/1.3.0 (interactive; macos-aarch64; build ac7280f2aca67769d1455a8847bb502b617d50f6)";

/** The endpoint is aggressively rate limited (429) and intermittently 5xx. */
export const MUSE_MINT_ATTEMPTS = 3;
const MUSE_MINT_RETRY_WAIT_MS = 2_000;

export interface MuseMintedKey {
  apiKey: string;
  accountId: string;
  subscriptionActive?: boolean;
  actionUrl?: string;
  tierName?: string;
}

export class MuseMintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MuseMintError";
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Remove a known secret from text before it is shown. The generic sanitizer
 * redacts by shape (and only lengths of 40+), so a caller that holds the actual
 * credential strips that exact value first: a device token echoed in an upstream
 * error body must not reach the dashboard.
 */
export function redactKnownSecret(text: string, secret: string): string {
  const value = secret.trim();
  if (!value || value.length < 8) return text;
  return text.split(value).join("[redacted]");
}

/**
 * Reject a mint response whose account cannot chat, at login time. Storing such
 * a key produces a chat that answers 404 model_not_found, which reads as a
 * broken router rather than a missing subscription.
 */
export function checkMuseMint(payload: Record<string, any>, apiKey: string): MuseMintedKey {
  const active = payload?.is_subs_active;
  const actionUrl = asString(payload?.require_payment_action_url) || asString(payload?.action_url);
  const accountId = asString(payload?.user_email) || asString(payload?.user_full_name);
  const tierName = asString(payload?.subs_tier_name);

  if (active === false) {
    throw new MuseMintError(
      "Muse: the Muse Code subscription is inactive; activate it on meta.ai first." +
        (accountId ? ` Account: ${accountId}.` : "")
    );
  }
  if (!apiKey) {
    if (payload?.require_payment || actionUrl) {
      throw new MuseMintError(
        actionUrl
          ? `Muse: a Muse Code subscription is required: ${actionUrl}`
          : "Muse: a Muse Code subscription is required."
      );
    }
    throw new MuseMintError("Muse: the mint response contained no api_key.");
  }
  return { apiKey, accountId, subscriptionActive: active !== false, actionUrl, tierName };
}

/** Read the minted credential under any of the names the endpoint uses. */
export function museApiKeyFrom(payload: Record<string, any>): string {
  return asString(payload?.api_key) || asString(payload?.apiKey) || asString(payload?.key);
}

/**
 * Muse identifies a conversation feed by a `session_id` request header, like
 * Codex. It is derived from the credential so the id stays stable across
 * requests and restarts for one login (a random per-request id would look like a
 * new machine on every turn), and so two accounts never share a feed.
 */
export function museSessionId(credential: string): string {
  const digest = crypto.createHash("sha256").update(`nesarouter-muse-session:${credential}`).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
}

/**
 * Exchange a Muse device (dca) token for the API key the model endpoint accepts.
 *
 * `onboard` enrols a fresh account on first login; without it a new account
 * mints a key the model endpoint answers with 404 model_not_found.
 */
export async function mintMuseKey(
  dcaToken: string,
  options: { mintUrl?: string; fetchImpl?: typeof fetch; sleepImpl?: (ms: number) => Promise<void> } = {}
): Promise<MuseMintedKey> {
  const token = dcaToken.trim();
  if (!token) throw new MuseMintError("Muse: missing device token.");
  const mintUrl = (options.mintUrl ?? MUSE_DEFAULT_MINT_URL).trim() || MUSE_DEFAULT_MINT_URL;
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleepImpl ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let body = "";
  let status = 0;
  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await doFetch(mintUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "user-agent": MUSE_MINT_USER_AGENT,
          "x-api-version": "1.0.0",
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({ onboard: true })
      });
    } catch (error) {
      throw new MuseMintError(`Muse: mint request failed: ${error instanceof Error ? error.message : "network error"}`);
    }
    status = response.status;
    body = await response.text().catch(() => "");
    const transient = status === 429 || status >= 500;
    if (!transient || attempt >= MUSE_MINT_ATTEMPTS) break;
    await sleep(MUSE_MINT_RETRY_WAIT_MS);
  }

  if (status >= 300) {
    const detail = sanitizeOAuthErrorBody(redactKnownSecret(body, token));
    throw new MuseMintError(`Muse: mint failed (HTTP ${status})${detail ? `: ${detail}` : ""}`);
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new MuseMintError("Muse: could not read the mint response as JSON.");
  }
  return checkMuseMint(payload, museApiKeyFrom(payload));
}
