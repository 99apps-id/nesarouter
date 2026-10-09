import crypto from "node:crypto";
import { ProviderConfig } from "@/core/types";
import {
  claudeResponseToOpenAi,
  claudeSseToOpenAiSse,
  openAiChatToClaudeRequest,
  openAiChatToResponsesRequest,
  responsesResponseToOpenAi,
  responsesSseToOpenAiSse
} from "@/core/translatorReverse";
import { stripPrivateRouterFields } from "@/core/providers/openaiCompatible";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, sortModelIds, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

/**
 * GitHub Copilot executor — calls api.githubcopilot.com using a short-lived
 * Copilot session token (exchanged from the GitHub OAuth access token).
 *
 * Mirrors the reference client (termixgo internal/provider/copilot.go):
 *  - Claude models are served by Copilot's Anthropic-shaped /v1/messages, not
 *    by /chat/completions, so they take the Anthropic branch.
 *  - A subset of newer models only answers on /responses; that is discovered
 *    from the /chat/completions error and remembered per model, so the failed
 *    attempt happens once per model for the life of the process.
 */

/** Wire ids Copilot serves, matching the reference catalogue. */
export const COPILOT_MODELS = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-6-luna",
  "claude-sonnet-5.5",
  "claude-sonnet-5",
  "claude-haiku-4.5",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "grok-4.7",
  "kimi-k3",
  "mai-code-1.1-flash"
];

/** Models a Copilot account has told us to serve through /responses. */
const copilotResponsesModels = new Set<string>();

function normalizeModel(model: string): string {
  return String(model ?? "").trim().toLowerCase();
}

function isClaudeModel(model: string): boolean {
  return normalizeModel(model).includes("claude");
}

/**
 * Copilot's Responses endpoint does not serve Gemini or Claude; only the
 * error-driven escalation is guarded by this (Claude never reaches it).
 */
function copilotSupportsResponses(model: string): boolean {
  const id = normalizeModel(model);
  return !id.includes("gemini") && !id.includes("claude");
}

/** The /chat/completions error that means "serve this model from /responses". */
function copilotEscalates(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("not accessible via the /chat/completions endpoint") ||
    message.includes("the requested model is not supported")
  );
}

/**
 * Copilot tags each request with a session id, derived from the credential so
 * one login keeps a stable session across requests.
 */
export function copilotSessionId(credential: string): string {
  return crypto.createHash("sha256").update(`copilot:${credential}`).digest("hex").slice(0, 32);
}

/** The Copilot API root, whether or not the preset pinned a full path. */
export function copilotRoot(provider: ProviderConfig): string {
  return baseUrl(provider).replace(/\/(chat\/completions|responses|v1\/messages)$/i, "");
}

function copilotHeaders(token: string, sessionId: string, accept: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    accept,
    "copilot-integration-id": "vscode-chat",
    "editor-version": "vscode/1.110.0",
    "editor-plugin-version": "copilot-chat/0.38.0",
    "user-agent": "GitHubCopilotChat/0.38.0",
    "openai-intent": "conversation-panel",
    "x-github-api-version": "2025-04-01",
    "x-vscode-user-agent-library-version": "electron-fetch",
    "X-Initiator": "user",
    "x-request-id": `copilot-${sessionId}`,
    session_id: sessionId,
    ...extra
  };
}

export class GithubCopilotExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    // Prefer Copilot session token; never use a bare GitHub OAuth access token here.
    const token = cleanApiKey(apiKey ?? provider.oauthCopilotToken ?? "");
    if (!token) {
      throw new UpstreamProviderError(`${provider.name} has no Copilot session token.`, 401);
    }
    const sessionId = copilotSessionId(token);
    const accept = body?.stream ? "text/event-stream" : "application/json";

    if (isClaudeModel(provider.model)) {
      return this.callClaude(provider, body, token, sessionId, accept);
    }
    if (copilotResponsesModels.has(normalizeModel(provider.model))) {
      return this.callResponses(provider, body, token, sessionId, accept);
    }
    return this.callChatCompletions(provider, body, token, sessionId, accept);
  }

  private async callChatCompletions(
    provider: ProviderConfig,
    body: any,
    token: string,
    sessionId: string,
    accept: string
  ) {
    const upstreamBody: Record<string, unknown> = {
      ...stripPrivateRouterFields(body),
      model: provider.model
    };
    if (body?.stream) {
      const streamOptions = body.stream_options && typeof body.stream_options === "object" ? body.stream_options : {};
      upstreamBody.stream_options = { ...streamOptions, include_usage: true };
    }

    const response = await proxyFetch(provider, baseUrl(provider), {
      method: "POST",
      headers: copilotHeaders(token, sessionId, accept),
      body: JSON.stringify(upstreamBody)
    });
    if (!response.ok) {
      const error = await upstreamError(provider, response);
      // Escalate once per model when Copilot says /chat/completions cannot serve it.
      if (copilotEscalates(error) && copilotSupportsResponses(provider.model)) {
        copilotResponsesModels.add(normalizeModel(provider.model));
        return this.callResponses(provider, body, token, sessionId, accept);
      }
      throw error;
    }
    if (body?.stream) return response.body ?? new ReadableStream<Uint8Array>();
    return response.json();
  }

  /** Copilot's OpenAI Responses endpoint, for models /chat/completions rejects. */
  private async callResponses(
    provider: ProviderConfig,
    body: any,
    token: string,
    sessionId: string,
    accept: string
  ) {
    const request = openAiChatToResponsesRequest({ ...stripPrivateRouterFields(body), model: provider.model });
    if (body?.stream && !request.stream) request.stream = true;

    const response = await proxyFetch(provider, `${copilotRoot(provider)}/responses`, {
      method: "POST",
      headers: copilotHeaders(token, sessionId, accept),
      body: JSON.stringify(request)
    });
    if (!response.ok) throw await upstreamError(provider, response);

    if (body?.stream) {
      if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
      return responsesSseToOpenAiSse(response.body, provider.model);
    }
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      throw new UpstreamProviderError(`${provider.name} returned an invalid responses payload.`, 502, {
        providerCode: "invalid_payload",
        providerType: provider.type
      });
    }
    return responsesResponseToOpenAi(payload, provider.model);
  }

  /** Copilot serves Claude through its Anthropic-shaped /v1/messages. */
  private async callClaude(
    provider: ProviderConfig,
    body: any,
    token: string,
    sessionId: string,
    accept: string
  ) {
    const request = openAiChatToClaudeRequest({ ...stripPrivateRouterFields(body), model: provider.model });
    const response = await proxyFetch(provider, `${copilotRoot(provider)}/v1/messages`, {
      method: "POST",
      headers: copilotHeaders(token, sessionId, accept, { "anthropic-version": "2023-06-01" }),
      body: JSON.stringify(request)
    });
    if (!response.ok) throw await upstreamError(provider, response);

    if (body?.stream) {
      if (!response.body) throw new UpstreamProviderError(`${provider.name} returned no stream body.`, 502);
      return claudeSseToOpenAiSse(response.body, provider.model);
    }
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      throw new UpstreamProviderError(`${provider.name} returned an invalid message payload.`, 502, {
        providerCode: "invalid_payload",
        providerType: provider.type
      });
    }
    return claudeResponseToOpenAi(payload, provider.model);
  }

  async listModels(_provider: ProviderConfig) {
    return sortModelIds(COPILOT_MODELS);
  }

  async validate(provider: ProviderConfig) {
    const copilot = cleanApiKey(provider.oauthCopilotToken || "");
    const github = cleanApiKey(provider.oauthAccessToken || "");
    if (!copilot && !github) {
      throw new UpstreamProviderError(`${provider.name} needs a GitHub OAuth connection.`, 400);
    }
    return {
      models: await this.listModels(provider),
      message: copilot
        ? "GitHub Copilot session token present."
        : "GitHub OAuth token present (Copilot session will refresh on chat)."
    };
  }
}
