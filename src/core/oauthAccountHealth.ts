import { UpstreamProviderError } from "@/core/providers/shared";
import { OAuthAccount, ProviderConfig } from "@/core/types";

/** Errors that mean the account should be skipped in routing (auth, quota, no access). */
export function isOAuthAccountFatalError(error: UpstreamProviderError): boolean {
  const text = `${error.message} ${error.providerCode ?? ""} ${error.providerType ?? ""}`.toLowerCase();
  // Cursor uses non-standard HTTP 464 when the imported IDE session/device is
  // rejected for inference. Retrying the same account cannot recover it, so it
  // must stop being advertised and selected as routable.
  if (error.status === 464) return true;
  if ([401, 402, 403].includes(error.status)) return true;
  if (error.status === 429 && /quota|billing|credit|exhausted|insufficient|limit reached|spend/.test(text)) return true;
  if (/subscription.*expired|expired.*subscription|not authorized|no access|invalid.*token|forbidden|payment required|billing|credit|quota exceeded|insufficient_quota|account.*disabled/.test(text)) {
    return true;
  }
  return false;
}

export function oauthAccountHasToken(account: OAuthAccount) {
  return Boolean(account.oauthAccessToken?.trim() || account.oauthCopilotToken?.trim());
}

/**
 * Profile-specific material beyond a bearer token (Cursor machine id, etc.).
 * Soft validate already enforces these; routing must match so Connected ≠ unusable.
 */
export function oauthAccountHasRequiredMaterial(account: OAuthAccount, provider?: Pick<ProviderConfig, "oauthProfile" | "type">) {
  if (!oauthAccountHasToken(account)) return false;
  const profile = provider?.oauthProfile;
  if (profile === "cursor" || provider?.type === "cursor") {
    return Boolean(account.oauthMachineId?.trim());
  }
  return true;
}

/** Account is eligible for routing: has token (+ profile material), not marked error/no-sub, not rate-limited. */
export function isOAuthAccountRoutable(
  account: OAuthAccount,
  now = Date.now(),
  provider?: Pick<ProviderConfig, "oauthProfile" | "type">
) {
  if (!oauthAccountHasRequiredMaterial(account, provider)) return false;
  if (account.connectionStatus === "error" || account.connectionStatus === "no_subscription") return false;
  if (account.rateLimitedUntil && new Date(account.rateLimitedUntil).getTime() > now) return false;
  return true;
}

export function oauthAccountStatusLabel(
  account: OAuthAccount,
  provider?: Pick<ProviderConfig, "oauthProfile" | "type">
): "connected" | "error" | "no_subscription" | "empty" | "unknown" {
  if (!oauthAccountHasToken(account)) return "empty";
  if (provider && !oauthAccountHasRequiredMaterial(account, provider)) return "error";
  if (account.connectionStatus === "no_subscription") return "no_subscription";
  if (account.connectionStatus === "error") return "error";
  if (account.connectionStatus === "connected") return "connected";
  return "unknown";
}
