import { getPreset } from "@/core/oauthProviderPresets";
import { cloudCodeAssistProbeMetadata, loadAntigravityProjectId } from "@/core/oauthPkce";
import { geminiStreamToOpenAiSse } from "@/core/streaming";
import { ProviderConfig } from "@/core/types";
import { fromGeminiResponse, toGeminiRequest } from "@/core/providers/gemini";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, UpstreamProviderError, upstreamError } from "@/core/providers/shared";
import { saveProviderOAuthTokens } from "@/lib/store";

/**
 * Gemini CLI / Antigravity executor — calls cloudcode-pa.googleapis.com/v1internal
 * using a Google OAuth bearer token. Headers and project id come from the OAuth preset.
 */
export class GeminiCliExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.oauthAccessToken ?? "");
    if (!token) throw new UpstreamProviderError(`${provider.name} has no OAuth access token.`, 401);
    const preset = getPreset(provider.oauthProfile);
    const geminiBody = toGeminiRequest(body);
    const project = await resolveCloudCodeProjectId(provider, token, body?.project);
    if (!project) {
      throw new UpstreamProviderError(
        `${provider.name} needs a Cloud Code project id. Re-connect OAuth (loadCodeAssist) or set oauth project on the provider.`,
        400
      );
    }
    const wrappedBody = { project, model: provider.model, request: geminiBody };
    const identityHeaders = preset?.upstreamHeaders ?? {
      "X-Goog-Api-Client": "google-genai-sdk/1.41.0 gl-node/v22.19.0",
      "User-Agent": "google-genai-sdk/1.41.0 gl-node/v22.19.0"
    };

    if (body?.stream) {
      const endpoint = `${baseUrl(provider)}:streamGenerateContent?alt=sse`;
      const response = await proxyFetch(provider, endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          accept: "text/event-stream",
          ...identityHeaders
        },
        body: JSON.stringify(wrappedBody)
      });
      if (!response.ok) throw await upstreamError(provider, response);
      if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
      return geminiStreamToOpenAiSse(response.body, provider, () => {});
    }

    const endpoint = `${baseUrl(provider)}:generateContent`;
    const response = await proxyFetch(provider, endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...identityHeaders
      },
      body: JSON.stringify(wrappedBody)
    });
    if (!response.ok) throw await upstreamError(provider, response);
    return fromGeminiResponse(provider, await response.json());
  }

  async listModels(provider: ProviderConfig) {
    const preset = getPreset(provider.oauthProfile);
    if (preset?.models?.length) return preset.models;
    return ["gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash"];
  }

  /**
   * Credential check without generateContent. Distinguishes:
   * - invalid token (401 hard fail / red)
   * - Google login OK but no Cloud Code / Gemini subscription (amber no_subscription)
   * - access OK (green), with or without a resolved project id
   */
  async validate(provider: ProviderConfig) {
    const token = cleanApiKey(provider.oauthAccessToken ?? "");
    if (!token) throw new UpstreamProviderError(`${provider.name} needs an OAuth access token.`, 400);
    const preset = getPreset(provider.oauthProfile);
    const models = await this.listModels(provider);
    const product =
      provider.oauthProfile === "antigravity" ? "Antigravity / Cloud Code" : "Gemini CLI / Cloud Code";

    if (preset?.loadCodeAssistUrl) {
      const response = await proxyFetch(provider, preset.loadCodeAssistUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(preset.upstreamHeaders ?? {})
        },
        body: JSON.stringify({ metadata: cloudCodeAssistProbeMetadata(preset) })
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        if (isCloudCodeAuthFailure(response.status, bodyText)) {
          throw new UpstreamProviderError(
            `${provider.name} returned ${response.status}: ${bodyText.slice(0, 400) || "OAuth token rejected."}`,
            response.status
          );
        }
        if (isCloudCodeNoSubscription(response.status, bodyText)) {
          return {
            models,
            connectionStatus: "no_subscription" as const,
            message: `Google login OK — no active ${product} subscription on this account. Subscribe or use another Google account.`
          };
        }
        throw new UpstreamProviderError(
          `${provider.name} returned ${response.status}: ${bodyText.slice(0, 400) || "Cloud Code probe failed."}`,
          response.status
        );
      }

      const project = await resolveCloudCodeProjectId(provider, token);
      return {
        models,
        connectionStatus: "connected" as const,
        message: project
          ? `${product} accepted · project ${project}.`
          : `${product} access OK. If chat fails, set OAuth project id on this provider.`
      };
    }

    await this.call(provider, {
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 8,
      stream: false
    });
    return {
      models,
      connectionStatus: "connected" as const,
      message: `Cloud Code token accepted${provider.oauthProjectId ? ` · project ${provider.oauthProjectId}` : ""}.`
    };
  }
}

/** Hard auth failure — token revoked / wrong client (not merely missing subscription). */
export function isCloudCodeAuthFailure(status: number, bodyText: string): boolean {
  if (status !== 401) return false;
  const text = bodyText.toLowerCase();
  if (/permission|forbidden|not.?entitled|not.?eligible|subscription|not.?enabled|access.?denied|PERMISSION_DENIED/i.test(text)) {
    return false;
  }
  return true;
}

/** Account authenticated but lacks Cloud Code / Gemini Code Assist entitlement. */
export function isCloudCodeNoSubscription(status: number, bodyText: string): boolean {
  if ([403, 404].includes(status)) return true;
  const text = bodyText.toLowerCase();
  return /permission|forbidden|not.?entitled|not.?eligible|subscription|not.?enabled|access.?denied|permission_denied|cloud.?code|code.?assist/i.test(
    text
  );
}

async function resolveCloudCodeProjectId(provider: ProviderConfig, token: string, bodyProject?: unknown): Promise<string> {
  const fromBody = typeof bodyProject === "string" ? bodyProject.trim() : "";
  if (fromBody) return fromBody;
  const existing = provider.oauthProjectId?.trim();
  if (existing) return existing;

  const preset = getPreset(provider.oauthProfile);
  if (!preset?.loadCodeAssistUrl) return "";

  const projectId = await loadAntigravityProjectId(preset, token);
  if (!projectId) return "";

  try {
    // Account-scoped provider snapshots contain only the active account.
    const accountId = provider.oauthAccounts?.[0]?.id;
    await saveProviderOAuthTokens(
      provider.id,
      {
        accessToken: token,
        refreshToken: provider.oauthRefreshToken,
        expiresAt: provider.oauthTokenExpiresAt,
        projectId
      },
      accountId ? { accountId } : undefined
    );
  } catch {
    // Best-effort persist; still use project for this request.
  }
  return projectId;
}
