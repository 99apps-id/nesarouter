import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import { AsyncLocalStorage } from "node:async_hooks";
import { ProviderConfig } from "@/core/types";

const proxyAgents = new Map<string, any>();
const requestSignalStorage = new AsyncLocalStorage<AbortSignal>();

export function withProviderRequestSignal<T>(signal: AbortSignal | undefined, run: () => Promise<T>) {
  return signal ? requestSignalStorage.run(signal, run) : run();
}

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
  let bodyBuffer: Buffer | undefined;
  if (!["GET", "HEAD"].includes(method.toUpperCase())) {
    if (init.body instanceof FormData) {
      const encoded = new Request("http://localhost", { method: "POST", body: init.body });
      bodyBuffer = Buffer.from(await encoded.arrayBuffer());
      const contentType = encoded.headers.get("content-type");
      if (contentType) headers["content-type"] = contentType;
    } else {
      bodyBuffer = await bodyToBuffer(init.body ?? null);
    }
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      { method, headers, agent },
      (res) => {
        const outHeaders = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (value == null) continue;
          if (Array.isArray(value)) value.forEach((v) => outHeaders.append(key, v));
          else outHeaders.set(key, value);
        }
        resolve(new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, { status: res.statusCode ?? 502, headers: outHeaders }));
      }
    );
    req.on("error", reject);
    const abort = () => req.destroy(new DOMException("The operation was aborted", "AbortError"));
    if (init.signal?.aborted) abort();
    else init.signal?.addEventListener("abort", abort, { once: true });
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

/**
 * fetch() wrapper that routes through the provider's outbound proxy when set.
 * Supports http(s) via undici ProxyAgent and socks4/5 via socks-proxy-agent.
 */
export async function proxyFetch(provider: ProviderConfig, url: string, init: RequestInit = {}): Promise<Response> {
  const timeout = AbortSignal.timeout(120_000);
  const requestSignal = requestSignalStorage.getStore();
  const signals = [init.signal, requestSignal, timeout].filter(Boolean) as AbortSignal[];
  const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
  const bounded = { ...init, signal };
  if (!provider.proxyUrl) return fetch(url, bounded);
  if (isSocksProxy(provider.proxyUrl)) {
    return socksFetch(provider.proxyUrl, url, bounded);
  }
  const dispatcher = await getHttpProxyDispatcher(provider.proxyUrl);
  if (dispatcher) return fetch(url, { ...bounded, dispatcher } as any);
  return fetch(url, bounded);
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

export type ProviderValidateResult = {
  models?: string[];
  message?: string;
  /** Soft outcome: auth OK but vendor subscription / entitlement missing. */
  connectionStatus?: "connected" | "no_subscription";
};

export interface ProviderExecutor {
  call(provider: ProviderConfig, body: any, apiKey?: string): Promise<any | ReadableStream<Uint8Array>>;
  listModels(provider: ProviderConfig): Promise<string[]>;
  validate?(provider: ProviderConfig): Promise<ProviderValidateResult>;
}

export function cleanApiKey(apiKey: string | undefined | null) {
  return String(apiKey ?? "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .trim();
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

/** Parse a successful upstream JSON response without leaking a raw SyntaxError. */
export async function upstreamJson<T = Record<string, unknown>>(
  provider: ProviderConfig,
  response: Response,
  context = "response"
): Promise<T> {
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new UpstreamProviderError(
      `${provider.name} returned malformed JSON for ${context}.`,
      502,
      { providerCode: "malformed_json", providerType: provider.type }
    );
  }
  if (payload === null || typeof payload !== "object") {
    throw new UpstreamProviderError(
      `${provider.name} returned an invalid JSON payload for ${context}.`,
      502,
      { providerCode: "invalid_payload", providerType: provider.type }
    );
  }
  return payload as T;
}
