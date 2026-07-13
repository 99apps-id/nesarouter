import crypto from "node:crypto";

const prefix = "nesa:v1";
const DEV_FALLBACK = "nesa-router-local-dev-key-change-in-production";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function resolveSecret(): string {
  const fromEnv = process.env.NESA_ENCRYPTION_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (isProduction()) {
    throw new Error(
      "NESA_ENCRYPTION_KEY is required in production. Set a long random secret before starting NesaRouter."
    );
  }
  return DEV_FALLBACK;
}

function key(secret = resolveSecret()) {
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string) {
  if (!value || value.startsWith(prefix)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [prefix, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string) {
  if (!value || !value.startsWith(prefix)) return value;
  const [, , ivPart, tagPart, encryptedPart] = value.split(":");
  const candidates = [process.env.NESA_ENCRYPTION_KEY?.trim(), DEV_FALLBACK].filter(Boolean) as string[];

  for (const secret of [...new Set(candidates)]) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key(secret), Buffer.from(ivPart, "base64url"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, "base64url")),
        decipher.final()
      ]).toString("utf8");
    } catch {}
  }

  return "";
}

export function redactSecret(value: string) {
  return value ? "********" : "";
}

export function isRedactedSecret(value: unknown): boolean {
  return typeof value === "string" && (/^\*+$/.test(value) || value === "[REDACTED]");
}
