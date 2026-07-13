import { UpstreamProviderError } from "@/core/providers/shared";
import { OAuthAccount } from "@/core/types";

/** Errors that mean the account should be skipped in routing (auth, quota, no access). */
export function isOAuthAccountFatalError(error: UpstreamProviderError): boolean {
  const text = `${error.message} ${error.providerCode ?? ""} ${error.providerType ?? ""}`.toLowerCase();
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

/** Account is eligible for routing: has token, not marked error, not in rate-limit cooldown window. */
export function isOAuthAccountRoutable(account: OAuthAccount, now = Date.now()) {
  if (!oauthAccountHasToken(account)) return false;
  if (account.connectionStatus === "error") return false;
  if (account.rateLimitedUntil && new Date(account.rateLimitedUntil).getTime() > now) return false;
  return true;
}

export function oauthAccountStatusLabel(account: OAuthAccount): "connected" | "error" | "empty" | "unknown" {
  if (!oauthAccountHasToken(account)) return "empty";
  if (account.connectionStatus === "error") return "error";
  if (account.connectionStatus === "connected") return "connected";
  return "unknown";
}
