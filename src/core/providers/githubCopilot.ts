import { ProviderConfig } from "@/core/types";
import { baseUrl, cleanApiKey, ProviderExecutor, proxyFetch, sortModelIds, UpstreamProviderError, upstreamError } from "@/core/providers/shared";

/**
 * GitHub Copilot executor — calls api.githubcopilot.com/chat/completions using
 * a short-lived Copilot session token (derived from the GitHub OAuth access
 * token). The wire format is OpenAI-compatible; Copilot-specific identity
 * headers are injected from the preset.
 */
export class GithubCopilotExecutor implements ProviderExecutor {
  async call(provider: ProviderConfig, body: any, apiKey?: string) {
    const token = cleanApiKey(apiKey ?? provider.oauthCopilotToken ?? "");
    if (!token) throw new Error(`${provider.name} has no Copilot session token.`);
    const upstreamBody: Record<string, unknown> = { ...body, model: provider.model };
    if (body?.stream) {
      const streamOptions = body.stream_options && typeof body.stream_options === "object" ? body.stream_options : {};
      upstreamBody.stream_options = { include_usage: true, ...streamOptions };
    }

    const response = await proxyFetch(provider, baseUrl(provider), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        accept: body?.stream ? "text/event-stream" : "application/json",
        "copilot-integration-id": "vscode-chat",
        "editor-version": "vscode/1.110.0",
        "editor-plugin-version": "copilot-chat/0.38.0",
        "user-agent": "GitHubCopilotChat/0.38.0",
        "openai-intent": "conversation-panel",
        "x-github-api-version": "2025-04-01",
        "x-vscode-user-agent-library-version": "electron-fetch",
        "X-Initiator": "user"
      },
      body: JSON.stringify(upstreamBody)
    });
    if (!response.ok) throw await upstreamError(provider, response);
    if (body?.stream) return response.body ?? new ReadableStream<Uint8Array>();
    return response.json();
  }

  async listModels(_provider: ProviderConfig) {
    return sortModelIds([
      "gpt-5.4", "gpt-5.4-mini", "gpt-5.2", "gpt-5.2-codex",
      "claude-sonnet-4.5", "claude-opus-4.5", "gemini-2.5-pro", "grok-code-fast-1"
    ]);
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
