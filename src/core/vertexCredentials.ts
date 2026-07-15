import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export type VertexSaJson = {
  type: "service_account";
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
};

export type VertexAdcJson = {
  type: "authorized_user";
  client_id: string;
  client_secret: string;
  refresh_token: string;
  quota_project_id?: string;
};

type CachedToken = { accessToken: string; expiresAt: number };

const tokenCache = new Map<string, CachedToken>();

function base64UrlJson(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signRs256Jwt(header: object, payload: object, privateKeyPem: string) {
  const data = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const signature = signer.sign(privateKeyPem.replace(/\\n/g, "\n"));
  return `${data}.${signature.toString("base64url")}`;
}

export function parseVertexSaJson(apiKey: string | undefined | null): VertexSaJson | null {
  if (!apiKey || typeof apiKey !== "string") return null;
  try {
    const parsed = JSON.parse(apiKey) as Partial<VertexSaJson>;
    if (
      parsed.type === "service_account" &&
      typeof parsed.client_email === "string" &&
      typeof parsed.private_key === "string" &&
      typeof parsed.project_id === "string"
    ) {
      return parsed as VertexSaJson;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

export function parseVertexAdcJson(apiKey: string | undefined | null): VertexAdcJson | null {
  if (!apiKey || typeof apiKey !== "string") return null;
  try {
    const parsed = JSON.parse(apiKey) as Partial<VertexAdcJson>;
    if (
      parsed.type === "authorized_user" &&
      typeof parsed.client_id === "string" &&
      typeof parsed.client_secret === "string" &&
      typeof parsed.refresh_token === "string"
    ) {
      return parsed as VertexAdcJson;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

export function resolveVertexProjectId(
  apiKey: string | undefined | null,
  explicitProjectId?: string | null
): string {
  const explicit = explicitProjectId?.trim();
  if (explicit) return explicit;
  const sa = parseVertexSaJson(apiKey);
  if (sa?.project_id) return sa.project_id;
  const adc = parseVertexAdcJson(apiKey);
  if (adc?.quota_project_id) return adc.quota_project_id;
  return "";
}

export async function mintVertexAccessToken(apiKey: string): Promise<string | null> {
  const sa = parseVertexSaJson(apiKey);
  if (sa) return mintServiceAccountToken(sa);
  const adc = parseVertexAdcJson(apiKey);
  if (adc) return refreshGoogleUserToken(adc);
  return null;
}

async function mintServiceAccountToken(sa: VertexSaJson): Promise<string | null> {
  const cacheKey = `sa:${sa.client_email}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.accessToken;

  const now = Math.floor(Date.now() / 1000);
  const assertion = signRs256Jwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: sa.client_email,
      scope: CLOUD_PLATFORM_SCOPE,
      aud: sa.token_uri || GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600
    },
    sa.private_key
  );

  const response = await fetch(sa.token_uri || GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString()
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (!data?.access_token) return null;
  const expiresAt = Date.now() + Number(data.expires_in ?? 3600) * 1000;
  tokenCache.set(cacheKey, { accessToken: data.access_token, expiresAt });
  return data.access_token as string;
}

async function refreshGoogleUserToken(adc: VertexAdcJson): Promise<string | null> {
  const cacheKey = `adc:${adc.client_id}:${adc.refresh_token.slice(0, 12)}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.accessToken;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: adc.refresh_token,
      client_id: adc.client_id,
      client_secret: adc.client_secret
    }).toString()
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (!data?.access_token) return null;
  const expiresAt = Date.now() + Number(data.expires_in ?? 3600) * 1000;
  tokenCache.set(cacheKey, { accessToken: data.access_token, expiresAt });
  return data.access_token as string;
}

/** Load ADC JSON from GOOGLE_APPLICATION_CREDENTIALS or the gcloud default path. */
export function readLocalAdcJson(): { json: string; path: string } | null {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const candidates = [
    envPath,
    path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json"),
    path.join(os.homedir(), "AppData", "Roaming", "gcloud", "application_default_credentials.json")
  ].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf8");
      if (parseVertexSaJson(raw) || parseVertexAdcJson(raw)) {
        return { json: raw, path: filePath };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export function describeVertexCredential(apiKey: string | undefined | null): "service_account" | "authorized_user" | "api_key" | "empty" {
  if (!apiKey?.trim()) return "empty";
  if (parseVertexSaJson(apiKey)) return "service_account";
  if (parseVertexAdcJson(apiKey)) return "authorized_user";
  return "api_key";
}
