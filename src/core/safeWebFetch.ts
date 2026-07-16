import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent } from "undici";

const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 100_000;

export class ExternalUrlValidationError extends Error {}

function isPrivateIpv4(value: string) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isBlockedAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const family = isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family === 6) {
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    const mapped = normalized.match(/^::ffff:(.+)$/);
    if (mapped) {
      if (isIP(mapped[1]) === 4) return isPrivateIpv4(mapped[1]);
      const words = mapped[1].split(":");
      if (words.length === 2 && words.every((word) => /^[0-9a-f]{1,4}$/i.test(word))) {
        const high = Number.parseInt(words[0], 16);
        const low = Number.parseInt(words[1], 16);
        return isPrivateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
      }
    }
    return false;
  }
  return normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local");
}

export async function validateExternalUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ExternalUrlValidationError("Invalid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ExternalUrlValidationError("Only HTTP and HTTPS URLs are allowed.");
  if (url.username || url.password) throw new ExternalUrlValidationError("URLs with credentials are not allowed.");
  if (isBlockedAddress(url.hostname)) throw new ExternalUrlValidationError("Private or local URLs are not allowed.");

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new ExternalUrlValidationError("Could not resolve URL host.");
  }
  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new ExternalUrlValidationError("Private or local URLs are not allowed.");
  }
  return url;
}

async function resolveExternalUrl(rawUrl: string | URL) {
  const url = await validateExternalUrl(String(rawUrl));
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  const target = addresses.find(({ address }) => !isBlockedAddress(address));
  if (!target) throw new ExternalUrlValidationError("Private or local URLs are not allowed.");
  return { url, ...target };
}

export function createPinnedLookup(address: string, family: number) {
  return (_hostname: string, options: any, callback: any) => {
    if (options?.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

function pinnedDispatcher(address: string, family: number) {
  return new Agent({
    connect: {
      lookup: createPinnedLookup(address, family)
    }
  });
}

async function readLimitedText(response: Response) {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = MAX_RESPONSE_BYTES - bytes;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      if (value.byteLength > remaining) {
        chunks.push(value.slice(0, remaining));
        bytes += remaining;
        truncated = true;
        break;
      }
      chunks.push(value);
      bytes += value.byteLength;
    }
  } finally {
    if (truncated) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(combined), truncated };
}

export async function fetchExternalText(rawUrl: string) {
  let resolved = await resolveExternalUrl(rawUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const dispatcher = pinnedDispatcher(resolved.address, resolved.family);
    let response: Response;
    try {
      response = await fetch(resolved.url, {
        headers: { "user-agent": "NesaRouter/0.1 (+local-gateway)" },
        signal: AbortSignal.timeout(10_000),
        redirect: "manual",
        dispatcher
      } as RequestInit & { dispatcher: Agent });
    } catch (error) {
      await dispatcher.close();
      throw error;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      await dispatcher.close();
      if (!location) throw new Error("Redirect response has no location.");
      if (redirects === MAX_REDIRECTS) throw new Error("Too many redirects.");
      resolved = await resolveExternalUrl(new URL(location, resolved.url).toString());
      continue;
    }
    try {
      const body = await readLimitedText(response);
      return { url: resolved.url.toString(), status: response.status, contentType: response.headers.get("content-type") || "", ...body };
    } finally {
      await dispatcher.close();
    }
  }
  throw new Error("Too many redirects.");
}
