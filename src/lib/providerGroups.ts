import { ProviderConfig } from "@/core/types";

export type ProviderGroupId = "oauth" | "free" | "free_tier" | "paid";

export const providerGroupMeta: Record<ProviderGroupId, { title: string; hint: string; tone: string }> = {
  oauth: {
    title: "OAuth / account sign-in",
    hint: "GitHub Copilot, ChatGPT, Kiro, Antigravity, Cursor — Connect / import, no API key.",
    tone: "oauth"
  },
  free: {
    title: "Free / Local",
    hint: "No paid API by default.",
    tone: "free"
  },
  free_tier: {
    title: "Free tier",
    hint: "Has free quota or starter credits.",
    tone: "free-tier"
  },
  paid: {
    title: "Paid",
    hint: "Use budget and fallback controls.",
    tone: "paid"
  }
};

const freeTierIds = new Set(["gemini-flash", "groq", "nvidia-nim", "github-models", "opencode-go", "byteplus-ark"]);
const freeSignals = ["free", "local", "ollama"];

export function providerGroup(provider: ProviderConfig): ProviderGroupId {
  const id = provider.id.toLowerCase();
  const name = provider.name.toLowerCase();
  if (provider.oauthProfile || id.startsWith("oauth-")) return "oauth";
  if (provider.tier === "free" || freeSignals.some((signal) => id.includes(signal) || name.includes(signal))) return "free";
  if (freeTierIds.has(id) || [...freeTierIds].some((signal) => id.startsWith(`${signal}-`))) return "free_tier";
  return "paid";
}
