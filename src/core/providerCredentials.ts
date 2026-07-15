import { ProviderConfig } from "@/core/types";

/** Providers that work without a user API key (public bearer, localhost, etc.). */
export function isKeylessProvider(provider: ProviderConfig) {
  if (provider.type === "opencode") return true;
  if (provider.id === "mimo-code-free") return true;
  if (/xiaomimimo\.com\/api\/free-ai/i.test(provider.baseUrl)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(provider.baseUrl)) return true;
  return false;
}

export function providerHasCredential(provider: ProviderConfig) {
  if (isKeylessProvider(provider)) return true;
  if (provider.apiKey?.trim()) return true;
  if (provider.oauthAccessToken || provider.oauthCopilotToken) return true;
  if (Array.isArray(provider.apiKeys) && provider.apiKeys.some((key) => typeof key === "string" && key.trim())) return true;
  return false;
}
