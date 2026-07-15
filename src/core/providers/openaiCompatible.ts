import { ProviderConfig } from "@/core/types";
import { getPreset } from "@/core/oauthProviderPresets";
import {
  bootstrapMimoFreeJwt,
  ensureMimoSystemPrompt,
  mimoFreeChatUrl,
  mimoFreeHeaders
} from "@/core/mimoFreeAuth";
import {
  baseUrl,
  cleanApiKey,
  azureOpenAiAuthHeaders,
  isAzureOpenAiHost,
  openRouterHeaders,
  ProviderExecutor,
  proxyFetch,
  sortModelIds,
  UpstreamProviderError,
  upstreamError,
  xiaomiMimoAuthHeaders,
  xiaomiMimoCredentialHint
} from "@/core/providers/shared";

/** DeepSeek V4 defaults thinking on; agent clients often drop reasoning_content → 400. */
export function shouldDisableDeepSeekThinking(provider: ProviderConfig, body: any): boolean {
  if (body?.thinking != null) return false;
  const host = baseUrl(provider).toLowerCase();
  const model = String(provider.model ?? body?.model ?? "").toLowerCase();
  // Never inject thinking flags onto Runware AIR ids or non-DeepSeek hosts.
  const isDeepSeekHost = host.includes("deepseek.com") || provider.id.toLowerCase() === "deepseek";
  if (!isDeepSeekHost) return false;
  // Reasoner / R1-style models should keep thinking enabled.
  if (/reasoner|r1|thinking/.test(model)) return false;
  return true;
}

/** Cline WorkOS tokens must be sent as `Bearer workos:…`. */
export function normalizeClineAccessToken(token: string, oauthProfile?: string): string {
  const cleaned = cleanApiKey(token);
  if (!cleaned) return "";
  if (oauthProfile !== "cline" && oauthProfile !== "clinepass") return cleaned;
  return cleaned.startsWith("workos:") ? cleaned : `workos:${cleaned}`;
}

function resolveBearerToken(provider: ProviderConfig, apiKey?: string): string {
  const raw = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? provider.apiKey);
  return normalizeClineAccessToken(raw, provider.oauthProfile);
}

function oauthUpstreamHeaders(provider: ProviderConfig): Record<string, string> {
  return getPreset(provider.oauthProfile)?.upstreamHeaders ?? {};
}

/** Chat URL — MiMo free posts to `…/openai/chat` (not `/chat/completions`). */
export function chatCompletionsUrl(provider: ProviderConfig): string {
  const root = baseUrl(provider).replace(/\/$/, "");
  if (/\/chat\/completions$/i.test(root)) return root;
  if (/\/openai\/chat$/i.test(root) || /\/api\/free-ai\/openai\/chat$/i.test(root)) return root;
  return `${root}/chat/completions`;
}

function isRunware(provider: ProviderConfig) {
  return provider.id === "runware" || /runware\.ai/i.test(provider.baseUrl);
}

function isMimoFree(provider: ProviderConfig) {
  return provider.id === "mimo-code-free" || /xiaomimimo\.com\/api\/free-ai/i.test(provider.baseUrl);
}

export class OpenAiCompatibleExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    if (isMimoFree(provider)) {
      const jwt = await bootstrapMimoFreeJwt();
      const upstreamBody: Record<string, unknown> = {
        ...body,
        model: "mimo-auto",
        messages: ensureMimoSystemPrompt(body?.messages)
      };
      if (body?.stream) {
        const streamOptions = body.stream_options && typeof body.stream_options === "object" ? body.stream_options : {};
        upstreamBody.stream_options = { include_usage: true, ...streamOptions };
      }
      const response = await proxyFetch(provider, mimoFreeChatUrl(provider.baseUrl), {
        method: "POST",
        headers: mimoFreeHeaders(jwt),
        body: JSON.stringify(upstreamBody)
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const jwtRetry = await bootstrapMimoFreeJwt(true);
          const retry = await proxyFetch(provider, mimoFreeChatUrl(provider.baseUrl), {
            method: "POST",
            headers: mimoFreeHeaders(jwtRetry),
            body: JSON.stringify(upstreamBody)
          });
          if (!retry.ok) throw await upstreamError(provider, retry);
          if (body?.stream) return retry.body ?? new ReadableStream<Uint8Array>();
          return retry.json();
        }
        throw await upstreamError(provider, response);
      }
      if (body?.stream) return response.body ?? new ReadableStream<Uint8Array>();
      return response.json();
    }

    const token = resolveBearerToken(provider, apiKey);
    const mismatch = xiaomiMimoCredentialHint(provider, token);
    if (mismatch) throw new UpstreamProviderError(mismatch, 400);
    // Azure rejects Bearer for key auth; use api-key only (see azureOpenAiAuthHeaders).
    const authHeaders: Record<string, string> =
      token && !isAzureOpenAiHost(provider.baseUrl) ? { authorization: `Bearer ${token}` } : {};
    const upstreamBody: Record<string, unknown> = {
      ...body,
      model: provider.model
    };

    if (shouldDisableDeepSeekThinking(provider, body)) {
      upstreamBody.thinking = { type: "disabled" };
    }

    if (body?.stream) {
      const streamOptions = body.stream_options && typeof body.stream_options === "object" ? body.stream_options : {};
      upstreamBody.stream_options = { include_usage: true, ...streamOptions };
    }

    const response = await proxyFetch(provider, chatCompletionsUrl(provider), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...oauthUpstreamHeaders(provider),
        ...authHeaders,
        ...xiaomiMimoAuthHeaders(token, provider),
        ...azureOpenAiAuthHeaders(token, provider),
        ...openRouterHeaders(provider)
      },
      body: JSON.stringify(upstreamBody)
    });

    if (!response.ok) throw await upstreamError(provider, response);
    if (body?.stream) return response.body ?? new ReadableStream<Uint8Array>();
    return response.json();
  }

  async listModels(provider: ProviderConfig) {
    if (isMimoFree(provider) || isRunware(provider)) {
      if (provider.models?.length) return [...provider.models];
      return provider.model ? [provider.model] : [];
    }

    const urls = this.modelUrls(provider);
    const token = resolveBearerToken(provider);
    const mismatch = xiaomiMimoCredentialHint(provider, token);
    if (mismatch) throw new UpstreamProviderError(mismatch, 400);
    const authHeaders: Record<string, string> =
      token && !isAzureOpenAiHost(provider.baseUrl) ? { authorization: `Bearer ${token}` } : {};
    let lastError: unknown;

    for (const url of urls) {
      const response = await proxyFetch(provider, url, {
        headers: {
          "content-type": "application/json",
          ...oauthUpstreamHeaders(provider),
          ...authHeaders,
          ...xiaomiMimoAuthHeaders(token, provider),
          ...azureOpenAiAuthHeaders(token, provider),
          ...openRouterHeaders(provider)
        }
      });

      if (response.ok) {
        const payload = await response.json();
        return sortModelIds((payload?.data ?? []).map((model: any) => String(model?.id ?? "")).filter(Boolean));
      }

      lastError = await upstreamError(provider, response);
      if (![404, 405].includes((lastError as any)?.status)) throw lastError;
    }

    if (provider.models?.length) return [...provider.models];
    throw lastError instanceof Error ? lastError : new Error(`${provider.name} models endpoint is unavailable.`);
  }

  async validate(provider: ProviderConfig) {
    if (isRunware(provider) || isMimoFree(provider)) {
      const models = provider.models?.length ? [...provider.models] : provider.model ? [provider.model] : [];
      if (isMimoFree(provider)) {
        return {
          models,
          message:
            "MiMo Code Free: will attempt anonymous JWT bootstrap on chat. Xiaomi may return illegal_access — prefer PAYG/Token Plan if bootstrap fails."
        };
      }
      const token = resolveBearerToken(provider);
      if (!token) throw new UpstreamProviderError(`${provider.name} needs an API key.`, 400);
      // Tiny probe — Runware often has no OpenAI /models list.
      const response = await proxyFetch(provider, chatCompletionsUrl(provider), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          stream: false
        })
      });
      if (!response.ok) throw await upstreamError(provider, response);
      return { models, message: models.length ? `Credentials accepted · ${models.length} preset models.` : "Credentials accepted." };
    }

    try {
      const models = await this.listModels(provider);
      return {
        models,
        message: provider.oauthProfile
          ? `OAuth accepted · ${models.length} models.`
          : models.length
            ? `${models.length} models found.`
            : "Credentials accepted."
      };
    } catch (error) {
      // OAuth specialty (Qwen/iFlow/Cline/…): /models often rejects while chat works.
      if (provider.oauthProfile) {
        const token = resolveBearerToken(provider);
        if (!token) throw new UpstreamProviderError(`${provider.name} needs an OAuth access token.`, 400);
        if (error instanceof UpstreamProviderError && error.status === 401) throw error;
        const models = provider.models?.length ? [...provider.models] : provider.model ? [provider.model] : [];
        return { models, message: "OAuth token present (model list unavailable)." };
      }
      throw error;
    }
  }

  private modelUrls(provider: ProviderConfig) {
    const primary = baseUrl(provider);
    const urls = [`${primary}/models`];
    if (!/\/v1(?:\/)?$/i.test(primary) && !provider.baseUrl.includes("openrouter.ai")) {
      urls.push(`${primary}/v1/models`);
    }
    return urls;
  }
}
