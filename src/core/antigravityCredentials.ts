import crypto from "node:crypto";

/**
 * Antigravity (Google Cloud Code) identity.
 *
 * The Google OAuth client pair is a confidential installed-app credential, so it
 * is never committed to this repository: it is injected ("stamped") by the
 * deployment. Resolution order:
 *
 *   1. NESA_ANTIGRAVITY_CLIENT_ID / NESA_ANTIGRAVITY_CLIENT_SECRET (runtime env)
 *   2. the same names in .env / .env.local, which Next.js loads itself
 *
 * It is deliberately NOT baked through `next.config.mjs` `env`: that block is
 * inlined into the *client* bundle as well, which would publish the client
 * secret to every visitor.
 */

export const ANTIGRAVITY_CLIENT_ID_ENV = "NESA_ANTIGRAVITY_CLIENT_ID";
export const ANTIGRAVITY_CLIENT_SECRET_ENV = "NESA_ANTIGRAVITY_CLIENT_SECRET";
export const ANTIGRAVITY_SESSION_ID_ENV = "NESA_ANTIGRAVITY_SESSION_ID";

export interface AntigravityCredentials {
  clientId: string;
  clientSecret: string;
}

function readEnv(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  // Operators paste values with surrounding quotes from shell snippets.
  return value.replace(/^["']|["']$/g, "").trim();
}

/** The stamped Google OAuth client pair. Empty strings mean "not stamped". */
export function antigravityCredentials(): AntigravityCredentials {
  return {
    clientId: readEnv(ANTIGRAVITY_CLIENT_ID_ENV),
    clientSecret: readEnv(ANTIGRAVITY_CLIENT_SECRET_ENV)
  };
}

/** True when the deployment stamped both halves of the client pair. */
export function hasAntigravityCredentials(): boolean {
  const { clientId, clientSecret } = antigravityCredentials();
  return Boolean(clientId && clientSecret);
}

/**
 * Actionable message for an unstamped deployment. Google answers a missing
 * client_id with "invalid_client", which sends operators hunting for a bug in
 * the OAuth flow instead of at the missing stamp.
 */
export function antigravityCredentialsError(): string {
  const { clientId, clientSecret } = antigravityCredentials();
  if (clientId && clientSecret) return "";
  const missing = [!clientId && ANTIGRAVITY_CLIENT_ID_ENV, !clientSecret && ANTIGRAVITY_CLIENT_SECRET_ENV]
    .filter(Boolean)
    .join(", ");
  return (
    `Antigravity OAuth is not configured: set ${missing} (deployment stamp / .env), then restart. ` +
    "The Google client pair is intentionally not committed to the repository."
  );
}

/**
 * The Google Cloud Code "machine session" id.
 *
 * Cloud Code expects a non-negative signed 63-bit integer as a string, and it
 * rejects a request whose session looks absent or negative. A random per-process
 * value would log every restart as a new machine, so the id is derived from a
 * stable seed (the provider's account/credential) and can be pinned by an
 * operator through NESA_ANTIGRAVITY_SESSION_ID.
 */
export function antigravitySessionId(seed = "nesarouter"): string {
  const pinned = readEnv(ANTIGRAVITY_SESSION_ID_ENV);
  if (pinned && /^\d+$/.test(pinned)) return pinned;
  const digest = crypto.createHash("sha256").update(`nesarouter-antigravity-session:${seed}`).digest();
  // Mask to 63 bits so the value is always a valid non-negative bigint string.
  return (digest.readBigUInt64BE(0) & 0x7fffffffffffffffn).toString();
}

/**
 * Cloud Code request id, in the shape the official IDE sends:
 * `agent/<random hex>/<unix millis>/<random hex>/<turn step>`. It is unique per
 * request by design (random + clock), and the trailing step is derived from the
 * message count, so a retry after a session reset is a different id.
 */
export function antigravityRequestId(session: string, model: string, messageCount: number): string {
  const step = Math.max(1, messageCount * 2 - 1);
  const seed = `${session}:${model}:${messageCount}:${Date.now()}:${crypto.randomBytes(8).toString("hex")}`;
  const digest = crypto.createHash("sha256").update(seed).digest("hex");
  return `agent/${digest.slice(0, 32)}/${Date.now()}/${digest.slice(32, 64)}/${step}`;
}
