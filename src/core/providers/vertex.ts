import { geminiStreamToOpenAiSse } from "@/core/streaming";
import { ProviderConfig } from "@/core/types";
import { fromGeminiResponse, toGeminiRequest } from "@/core/providers/gemini";
import {
  describeVertexCredential,
  mintVertexAccessToken,
  parseVertexAdcJson,
  parseVertexSaJson,
  resolveVertexProjectId
} from "@/core/vertexCredentials";
import { claudeResponseToOpenAi, claudeSseToOpenAiSse, openAiChatToClaudeRequest } from "@/core/translatorReverse";
import { ProviderExecutor, proxyFetch, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

function vertexLocation(provider: ProviderConfig) {
  return (provider.vertexLocation || process.env.NESA_VERTEX_LOCATION || "us-central1").trim() || "us-central1";
}

export function isVertexClaudeProvider(provider: ProviderConfig) {
  return (
    provider.id.includes("vertex-claude") ||
    provider.id.includes("vertex-anthropic") ||
    /^claude[-@]/i.test(provider.model)
  );
}

function isPartnerProvider(provider: ProviderConfig) {
  if (isVertexClaudeProvider(provider)) return false;
  return provider.id.includes("vertex-partner") || provider.model.includes("/");
}

/** Keep `@` revision markers used by Vertex Model Garden Claude IDs. */
export function encodeVertexClaudeModelId(model: string) {
  return model
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/%40/g, "@"))
    .join("/");
}

export function claudeOnVertexUrl(
  auth: { projectId: string; location: string },
  model: string,
  stream: boolean
) {
  const action = stream ? "streamRawPredict" : "rawPredict";
  const loc = (auth.location || "global").trim() || "global";
  // Global Vertex uses the unscoped host; regional uses `{region}-aiplatform.googleapis.com`.
  const host = loc === "global" ? "https://aiplatform.googleapis.com" : `https://${loc}-aiplatform.googleapis.com`;
  return `${host}/v1/projects/${encodeURIComponent(auth.projectId)}/locations/${encodeURIComponent(loc)}/publishers/anthropic/models/${encodeVertexClaudeModelId(model)}:${action}`;
}

async function resolveAuth(provider: ProviderConfig, apiKey?: string) {
  const key = (apiKey ?? provider.apiKey ?? "").trim();
  const kind = describeVertexCredential(key);
  const projectId = resolveVertexProjectId(key, provider.oauthProjectId);
  const location = vertexLocation(provider);

  if (kind === "empty") {
    throw new UpstreamProviderError(
      `${provider.name}: paste Service Account JSON, ADC authorized_user JSON (gcloud auth application-default login), or a Vertex API key.`,
      401
    );
  }

  if (kind === "service_account" || kind === "authorized_user") {
    if (!projectId) {
      throw new UpstreamProviderError(
        `${provider.name}: set GCP Project ID (ADC needs quota_project_id or an explicit Project ID on the provider).`,
        400
      );
    }
    const accessToken = await mintVertexAccessToken(key);
    if (!accessToken) {
      throw new UpstreamProviderError(`${provider.name}: failed to mint/refresh Google access token from credentials JSON.`, 401);
    }
    return { kind, projectId, location, accessToken, apiKey: null as string | null };
  }

  return { kind, projectId, location, accessToken: null as string | null, apiKey: key };
}

function geminiUrl(auth: Awaited<ReturnType<typeof resolveAuth>>, model: string, stream: boolean) {
  const action = stream ? "streamGenerateContent" : "generateContent";
  if (auth.accessToken) {
    let url = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(auth.projectId)}/locations/${encodeURIComponent(auth.location)}/publishers/google/models/${encodeURIComponent(model)}:${action}`;
    if (stream) url += "?alt=sse";
    return url;
  }
  let url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(model)}:${action}`;
  url += stream ? `?alt=sse&key=${encodeURIComponent(auth.apiKey!)}` : `?key=${encodeURIComponent(auth.apiKey!)}`;
  return url;
}

function partnerUrl(auth: Awaited<ReturnType<typeof resolveAuth>>) {
  if (!auth.projectId) {
    throw new UpstreamProviderError("Vertex Partner requires a GCP Project ID.", 400);
  }
  let url = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(auth.projectId)}/locations/global/endpoints/openapi/chat/completions`;
  if (auth.apiKey) url += `?key=${encodeURIComponent(auth.apiKey)}`;
  return url;
}

/**
 * Google Cloud Vertex AI — Gemini, Partner OpenAI-compatible, or Claude (Anthropic rawPredict).
 * Auth: Service Account JSON, ADC authorized_user JSON, or raw API key (Gemini/partner).
 */
export class VertexExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const auth = await resolveAuth(provider, apiKey);

    if (isVertexClaudeProvider(provider)) {
      if (!auth.accessToken) {
        throw new UpstreamProviderError(
          `${provider.name}: Claude on Vertex requires Service Account or ADC JSON (API keys are not supported).`,
          401
        );
      }
      if (!auth.projectId) {
        throw new UpstreamProviderError(`${provider.name}: set GCP Project ID for Claude on Vertex.`, 400);
      }
      const claudeReq = openAiChatToClaudeRequest({ ...body, model: provider.model });
      const { model: _drop, ...rest } = claudeReq;
      const upstreamBody = {
        ...rest,
        anthropic_version: "vertex-2023-10-16"
      };
      const headers: Record<string, string> = {
        "content-type": "application/json",
        authorization: `Bearer ${auth.accessToken}`
      };
      const response = await proxyFetch(provider, claudeOnVertexUrl(auth, provider.model, Boolean(body?.stream)), {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody)
      });
      if (!response.ok) throw await upstreamError(provider, response);
      if (body?.stream) {
        if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
        return claudeSseToOpenAiSse(response.body, provider.model);
      }
      return claudeResponseToOpenAi(await response.json(), provider.model);
    }

    if (isPartnerProvider(provider)) {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (auth.accessToken) headers.authorization = `Bearer ${auth.accessToken}`;
      const upstreamBody = {
        ...body,
        model: provider.model,
        stream: Boolean(body?.stream)
      };
      const response = await proxyFetch(provider, partnerUrl(auth), {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody)
      });
      if (!response.ok) throw await upstreamError(provider, response);
      if (body?.stream) return response.body ?? new ReadableStream<Uint8Array>();
      return response.json();
    }

    const geminiBody = toGeminiRequest(body);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth.accessToken) headers.authorization = `Bearer ${auth.accessToken}`;

    if (body?.stream) {
      headers.accept = "text/event-stream";
      const response = await proxyFetch(provider, geminiUrl(auth, provider.model, true), {
        method: "POST",
        headers,
        body: JSON.stringify(geminiBody)
      });
      if (!response.ok) throw await upstreamError(provider, response);
      if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
      return geminiStreamToOpenAiSse(response.body, provider, () => {});
    }

    const response = await proxyFetch(provider, geminiUrl(auth, provider.model, false), {
      method: "POST",
      headers,
      body: JSON.stringify(geminiBody)
    });
    if (!response.ok) throw await upstreamError(provider, response);
    return fromGeminiResponse(provider, await response.json());
  }

  async listModels(provider: ProviderConfig) {
    if (provider.models?.length) return [...provider.models];
    if (isVertexClaudeProvider(provider)) {
      return [
        "claude-opus-4-8",
        "claude-opus-4-7",
        "claude-sonnet-4-6",
        "claude-sonnet-4-5@20250929",
        "claude-haiku-4-5@20251001",
        "claude-opus-4-5@20251101"
      ];
    }
    if (isPartnerProvider(provider)) {
      return [
        "deepseek-ai/deepseek-v3.2-maas",
        "qwen/qwen3-next-80b-a3b-instruct-maas",
        "zai-org/glm-5-maas"
      ];
    }
    return [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-3-flash-preview",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite-preview"
    ];
  }

  async validate(provider: ProviderConfig) {
    const kind = describeVertexCredential(provider.apiKey);
    const projectId = resolveVertexProjectId(provider.apiKey, provider.oauthProjectId);
    if (isVertexClaudeProvider(provider) && kind === "api_key") {
      throw new UpstreamProviderError("Claude on Vertex requires Service Account or ADC JSON.", 401);
    }
    if (kind === "service_account" || kind === "authorized_user") {
      const token = await mintVertexAccessToken(provider.apiKey);
      if (!token) throw new UpstreamProviderError("Could not mint access token from Vertex credentials JSON.", 401);
      if (!projectId) throw new UpstreamProviderError("Set GCP Project ID for Vertex ADC/SA auth.", 400);
      return {
        models: await this.listModels(provider),
        message: `Vertex ${kind === "service_account" ? "service account" : "ADC"} OK · project ${projectId}${isVertexClaudeProvider(provider) ? " · Claude rawPredict" : ""}`
      };
    }
    if (kind === "api_key") {
      return { models: await this.listModels(provider), message: "Vertex API key present (project path resolved by Google)." };
    }
    throw new UpstreamProviderError("Missing Vertex credentials.", 401);
  }
}

export function vertexCredentialHint(apiKey: string | undefined | null): string {
  if (parseVertexSaJson(apiKey)) return "Service Account JSON detected";
  if (parseVertexAdcJson(apiKey)) return "ADC authorized_user JSON detected (gcloud application-default login)";
  if (apiKey?.trim()) return "Treating value as Vertex API key";
  return "Paste SA JSON, ADC JSON, or API key";
}
