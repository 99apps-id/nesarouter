/** Cloudflare Workers AI OpenAI-compatible base URL helpers. */

export const CLOUDFLARE_WORKERS_AI_TEMPLATE =
  "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1";

export function isCloudflareWorkersAiProvider(provider: { id?: string; baseUrl?: string; name?: string }) {
  const hay = `${provider.id ?? ""} ${provider.name ?? ""} ${provider.baseUrl ?? ""}`.toLowerCase();
  return hay.includes("cloudflare") || hay.includes("workers-ai") || hay.includes("api.cloudflare.com");
}

export function extractCloudflareAccountId(baseUrl: string | undefined | null, explicit?: string | null): string {
  if (explicit?.trim() && explicit.trim() !== "YOUR_ACCOUNT_ID") return explicit.trim();
  const match = String(baseUrl ?? "").match(/\/accounts\/([^/]+)/i);
  if (!match || match[1] === "YOUR_ACCOUNT_ID") return "";
  return match[1];
}

export function withCloudflareAccountId(baseUrl: string | undefined | null, accountId: string): string {
  const id = accountId.trim();
  const current = (baseUrl || CLOUDFLARE_WORKERS_AI_TEMPLATE).trim() || CLOUDFLARE_WORKERS_AI_TEMPLATE;
  if (!id) return current;
  if (/\/accounts\/[^/]+/i.test(current)) {
    return current.replace(/\/accounts\/[^/]+/i, `/accounts/${id}`);
  }
  return `https://api.cloudflare.com/client/v4/accounts/${id}/ai/v1`;
}
