import http from "node:http";
import https from "node:https";
import { ProviderConfig } from "@/core/types";

const proxyAgents = new Map<string, any>();

function isSocksProxy(proxyUrl: string) {
  return /^socks(4a?|5h?):\/\//i.test(proxyUrl);
}

async function getHttpProxyDispatcher(proxyUrl: string): Promise<any> {
  let agent = proxyAgents.get(proxyUrl);
  if (agent) return agent;
  try {
    const undici = await import("undici");
    const ProxyAgent = (undici as any).ProxyAgent;
    if (!ProxyAgent) return undefined;
    agent = new ProxyAgent(proxyUrl);
    proxyAgents.set(proxyUrl, agent);
    return agent;
  } catch {
    return undefined;
  }
}

async function getSocksAgent(proxyUrl: string): Promise<any> {
  let agent = proxyAgents.get(proxyUrl);
  if (agent) return agent;
  try {
    const { SocksProxyAgent } = await import("socks-proxy-agent");
    agent = new SocksProxyAgent(proxyUrl);
    proxyAgents.set(proxyUrl, agent);
    return agent;
  } catch {
    return undefined;
  }
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

async function bodyToBuffer(body: BodyInit | null | undefined): Promise<Buffer | undefined> {
  if (body == null) return undefined;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (typeof (body as any).arrayBuffer === "function") {
    return Buffer.from(await (body as Blob).arrayBuffer());
  }
  if (body instanceof FormData) {
    // Let undici/global fetch handle FormData without SOCKS agent when possible;
    // for SOCKS we need multipart encoding — fall back to Request.
    const req = new Request("http://localhost", { method: "POST", body });
    return Buffer.from(await req.arrayBuffer());
  }
  return Buffer.from(String(body));
}

async function socksFetch(proxyUrl: string, url: string, init: RequestInit = {}): Promise<Response> {
  const agent = await getSocksAgent(proxyUrl);
  if (!agent) throw new Error(`SOCKS proxy unavailable for ${proxyUrl}`);
  const parsed = new URL(url);
  const lib = parsed.protocol === "http:" ? http : https;
  const method = init.method ?? "GET";
  const headers = headersToRecord(init.headers);
  const bodyBuffer = ["GET", "HEAD"].includes(method.toUpperCase()) ? undefined : await bodyToBuffer(init.body ?? null);

  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      { method, headers, agent },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const outHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value == null) continue;
            if (Array.isArray(value)) value.forEach((v) => outHeaders.append(key, v));
            else outHeaders.set(key, value);
          }
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 502, headers: outHeaders }));
        });
      }
    );
    req.on("error", reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

/**
 * fetch() wrapper that routes through the provider's outbound proxy when set.
 * Supports http(s) via undici ProxyAgent and socks4/5 via socks-proxy-agent.
 */
export async function proxyFetch(provider: ProviderConfig, url: string, init: RequestInit = {}): Promise<Response> {
  if (!provider.proxyUrl) return fetch(url, init);
  if (isSocksProxy(provider.proxyUrl)) {
    return socksFetch(provider.proxyUrl, url, init);
  }
  const dispatcher = await getHttpProxyDispatcher(provider.proxyUrl);
  if (dispatcher) return fetch(url, { ...init, dispatcher } as any);
  return fetch(url, init);
}

export class UpstreamProviderError extends Error {
  status: number;
  providerCode?: string;
  providerType?: string;

  constructor(message: string, status: number, details?: { providerCode?: string; providerType?: string }) {
    super(message);
    this.name = "UpstreamProviderError";
    this.status = status;
    this.providerCode = details?.providerCode;
    this.providerType = details?.providerType;
  }
}

export interface ProviderExecutor {
  call(provider: ProviderConfig, body: any, apiKey?: string): Promise<any | ReadableStream<Uint8Array>>;
  listModels(provider: ProviderConfig): Promise<string[]>;
  validate?(provider: ProviderConfig): Promise<{ models?: string[]; message?: string }>;
}

export function cleanApiKey(apiKey: string) {
  return apiKey.trim().replace(/^Bearer\s+/i, "").trim();
}

export function baseUrl(provider: ProviderConfig) {
  return provider.baseUrl.replace(/\/$/, "");
}

export function sortModelIds(modelIds: string[]) {
  return [...new Set(modelIds)].sort((a, b) => a.localeCompare(b));
}

export function openRouterHeaders(provider: ProviderConfig): Record<string, string> {
  if (!provider.baseUrl.includes("openrouter.ai")) return {};
  return {
    "HTTP-Referer": "https://github.com/nesa-ai/NesaRouter",
    "X-Title": "NesaRouter",
    "X-OpenRouter-Title": "NesaRouter"
  };
}

export function isXiaomiMimoHost(baseUrl: string) {
  return /xiaomimimo\.com/i.test(baseUrl);
}

export function isXiaomiTokenPlanHost(baseUrl: string) {
  return /token-plan-/i.test(baseUrl) && /xiaomimimo\.com/i.test(baseUrl);
}

/**
 * Xiaomi docs show curl with `api-key` while the OpenAI SDK uses Bearer.
 * Send both so pay-as-you-go and Token Plan keys work through either path.
 */
export function xiaomiMimoAuthHeaders(token: string, provider: ProviderConfig): Record<string, string> {
  if (!token || !isXiaomiMimoHost(provider.baseUrl)) return {};
  return { "api-key": token };
}

/** Azure OpenAI / AI Foundry keys authenticate with `api-key` (Bearer alone is often rejected). */
export function isAzureOpenAiHost(url: string) {
  return /openai\.azure\.com|cognitiveservices\.azure\.com|services\.ai\.azure\.com/i.test(url);
}

export function azureOpenAiAuthHeaders(token: string, provider: ProviderConfig): Record<string, string> {
  if (!token || !isAzureOpenAiHost(provider.baseUrl)) return {};
  return { "api-key": token };
}

/** Catch sk-/tp- key mixups against the wrong Xiaomi base URL before upstream 401s. */
export function xiaomiMimoCredentialHint(provider: ProviderConfig, token: string): string | undefined {
  if (!token || !isXiaomiMimoHost(provider.baseUrl)) return undefined;
  const tokenPlanHost = isXiaomiTokenPlanHost(provider.baseUrl);
  if (/^tp[-_]/i.test(token) && !tokenPlanHost) {
    return "This looks like a Token Plan key (tp-…). Use Xiaomi MiMo (Token Plan) with base URL https://token-plan-sgp.xiaomimimo.com/v1 (or -cn / -ams), not api.xiaomimimo.com.";
  }
  if (/^sk[-_]/i.test(token) && tokenPlanHost) {
    return "This looks like a pay-as-you-go key (sk-…). Use Xiaomi MiMo with base URL https://api.xiaomimimo.com/v1, not the Token Plan host.";
  }
  return undefined;
}

export async function upstreamError(provider: ProviderConfig, response: Response) {
  const errorText = await response.text();
  let providerCode: string | undefined;
  let providerType: string | undefined;

  try {
    const payload = JSON.parse(errorText);
    providerCode = payload?.error?.code ? String(payload.error.code) : undefined;
    providerType = payload?.error?.type ? String(payload.error.type) : undefined;
  } catch {}

  return new UpstreamProviderError(`${provider.name} returned ${response.status}: ${errorText.slice(0, 500)}`, response.status, {
    providerCode,
    providerType
  });
}
