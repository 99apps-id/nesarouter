import { ProviderTier } from "@/core/types";

export const tierLabel: Record<ProviderTier, string> = {
  free: "Free",
  cheap: "Cheap",
  balanced: "Balanced",
  premium: "Premium"
};

export function keyPreview(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return `${key.slice(0, 2)}…${key.slice(-2)}`;
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
}
