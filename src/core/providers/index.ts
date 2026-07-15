import { ProviderConfig } from "@/core/types";
import { isKeylessProvider } from "@/core/providerCredentials";
import { GeminiExecutor } from "@/core/providers/gemini";
import { GeminiCliExecutor } from "@/core/providers/geminiCli";
import { GithubCopilotExecutor } from "@/core/providers/githubCopilot";
import { OpenAiCompatibleExecutor } from "@/core/providers/openaiCompatible";
import { AnthropicMessagesExecutor } from "@/core/providers/anthropic";
import { OpenAiResponsesExecutor } from "@/core/providers/openaiResponses";
import { KiroExecutor } from "@/core/providers/kiro";
import { OpenCodeExecutor } from "@/core/providers/opencode";
import { CursorExecutor } from "@/core/providers/cursor";
import { VertexExecutor } from "@/core/providers/vertex";
import { GrokWebExecutor } from "@/core/providers/grokWeb";
import { ProviderExecutor, UpstreamProviderError, cleanApiKey } from "@/core/providers/shared";
import { isChatgptCodexUpstream } from "@/core/translatorReverse";

const executors: Record<ProviderConfig["type"], ProviderExecutor> = {
  gemini: new GeminiExecutor(),
  gemini_cli: new GeminiCliExecutor(),
  github_copilot: new GithubCopilotExecutor(),
  openai_compatible: new OpenAiCompatibleExecutor(),
  anthropic_messages: new AnthropicMessagesExecutor(),
  openai_responses: new OpenAiResponsesExecutor(),
  kiro: new KiroExecutor(),
  opencode: new OpenCodeExecutor(),
  cursor: new CursorExecutor(),
  vertex: new VertexExecutor(),
  grok_web: new GrokWebExecutor()
};

export { UpstreamProviderError };

/** Force Responses executor when talking to ChatGPT Codex (type misconfig safe). */
function coerceProviderForCall(provider: ProviderConfig): ProviderConfig {
  if (!isChatgptCodexUpstream(provider)) return provider;
  if (provider.type === "openai_responses") return provider;
  return {
    ...provider,
    type: "openai_responses",
    oauthProfile: provider.oauthProfile ?? "openai_codex"
  };
}

export function getProviderExecutor(provider: ProviderConfig) {
  return executors[provider.type] ?? executors.openai_compatible;
}

export async function callProvider(provider: ProviderConfig, body: any, apiKey?: string) {
  const effective = coerceProviderForCall(provider);
  return getProviderExecutor(effective).call(effective, body, apiKey);
}

export async function listProviderModels(provider: ProviderConfig) {
  const effective = coerceProviderForCall(provider);
  const keylessAllowed =
    effective.oauthProfile ||
    isKeylessProvider(effective) ||
    effective.type === "vertex" ||
    effective.type === "grok_web";

  if (!cleanApiKey(effective.apiKey) && !keylessAllowed) throw new UpstreamProviderError("Provider API key is empty.", 400);
  return getProviderExecutor(effective).listModels(effective);
}

export async function testProviderConnection(provider: ProviderConfig) {
  const effective = coerceProviderForCall(provider);
  const executor = getProviderExecutor(effective);
  if (executor.validate) return executor.validate(effective);

  try {
    const models = await executor.listModels(effective);
    return { models, message: models.length ? `${models.length} models found.` : "Credentials accepted." };
  } catch (error) {
    if (error instanceof UpstreamProviderError && [401, 403].includes(error.status)) throw error;
  }

  return callProvider(effective, {
    messages: [{ role: "user", content: "Reply with OK." }],
    max_tokens: 8,
    temperature: 0
  });
}
