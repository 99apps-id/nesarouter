import { ProviderConfig } from "@/core/types";
import { GeminiExecutor } from "@/core/providers/gemini";
import { GeminiCliExecutor } from "@/core/providers/geminiCli";
import { GithubCopilotExecutor } from "@/core/providers/githubCopilot";
import { OpenAiCompatibleExecutor } from "@/core/providers/openaiCompatible";
import { AnthropicMessagesExecutor } from "@/core/providers/anthropic";
import { OpenAiResponsesExecutor } from "@/core/providers/openaiResponses";
import { KiroExecutor } from "@/core/providers/kiro";
import { CursorExecutor } from "@/core/providers/cursor";
import { ProviderExecutor, UpstreamProviderError, cleanApiKey } from "@/core/providers/shared";

const executors: Record<ProviderConfig["type"], ProviderExecutor> = {
  gemini: new GeminiExecutor(),
  gemini_cli: new GeminiCliExecutor(),
  github_copilot: new GithubCopilotExecutor(),
  openai_compatible: new OpenAiCompatibleExecutor(),
  anthropic_messages: new AnthropicMessagesExecutor(),
  openai_responses: new OpenAiResponsesExecutor(),
  kiro: new KiroExecutor(),
  cursor: new CursorExecutor()
};

export { UpstreamProviderError };

export function getProviderExecutor(provider: ProviderConfig) {
  return executors[provider.type] ?? executors.openai_compatible;
}

export async function callProvider(provider: ProviderConfig, body: any, apiKey?: string) {
  return getProviderExecutor(provider).call(provider, body, apiKey);
}

export async function listProviderModels(provider: ProviderConfig) {
  const keylessAllowed =
    provider.oauthProfile ||
    provider.type === "kiro" ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(provider.baseUrl);

  if (!cleanApiKey(provider.apiKey) && !keylessAllowed) throw new UpstreamProviderError("Provider API key is empty.", 400);
  return getProviderExecutor(provider).listModels(provider);
}

export async function testProviderConnection(provider: ProviderConfig) {
  const executor = getProviderExecutor(provider);
  if (executor.validate) return executor.validate(provider);

  try {
    const models = await executor.listModels(provider);
    return { models, message: models.length ? `${models.length} models found.` : "Credentials accepted." };
  } catch (error) {
    if (error instanceof UpstreamProviderError && [401, 403].includes(error.status)) throw error;
  }

  return callProvider(provider, {
    messages: [{ role: "user", content: "Reply with OK." }],
    max_tokens: 8,
    temperature: 0
  });
}
