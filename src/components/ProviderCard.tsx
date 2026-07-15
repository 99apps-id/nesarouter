import Link from "next/link";
import { ChevronRight, KeyRound, Layers } from "lucide-react";
import { ProviderConfig } from "@/core/types";
import { tierLabel } from "@/lib/providerLabels";
import ProviderIcon from "@/components/ProviderIcon";

export default function ProviderCard({
  provider,
  hasApiKey,
  hasExtraKeys,
  hasOAuthToken,
  oauthAccountCount = 0,
  routableOAuthCount = 0
}: {
  provider: ProviderConfig;
  hasApiKey: boolean;
  hasExtraKeys: boolean;
  hasOAuthToken: boolean;
  oauthAccountCount?: number;
  routableOAuthCount?: number;
}) {
  const keyCount = (hasApiKey ? 1 : 0) + (provider.apiKeys?.length ?? 0);
  const isAccountProvider = Boolean(provider.oauthProfile);
  const modelCount = Array.isArray(provider.models) && provider.models.length ? provider.models.length : 1;
  const connectionStatus = provider.connectionStatus ?? "unknown";
  // OAuth cards: never show "Connected" without actual account tokens (stale connection_status).
  const statusTone = isAccountProvider
    ? routableOAuthCount > 0
      ? "success"
      : hasOAuthToken
        ? connectionStatus === "no_subscription"
          ? "warning"
          : "error"
        : "neutral"
    : connectionStatus === "connected"
      ? "success"
      : connectionStatus === "error"
        ? "error"
        : "neutral";
  const statusLabel = isAccountProvider
    ? routableOAuthCount > 0
      ? "Connected"
      : hasOAuthToken
        ? connectionStatus === "no_subscription"
          ? "No subscription"
          : "Error"
        : "Not connected"
    : connectionStatus === "connected"
      ? "Connected"
      : connectionStatus === "error"
        ? "Error"
        : "Not tested";

  return (
    <Link href={`/providers/${provider.id}`} className="provider-card">
      <ProviderIcon provider={provider} size="md" active={provider.status === "active"} />
      <div className="provider-card-body">
        <strong>{provider.name}</strong>
        <span className="subtle">{tierLabel[provider.tier]} · {provider.type}</span>
        <div className="provider-badges">
          <span className={`status ${statusTone}`}>{statusLabel}</span>
          <span className={`status ${provider.status === "active" ? "success" : "neutral"}`}>{provider.status}</span>
          {isAccountProvider ? (
            <span className={`status ${routableOAuthCount > 0 ? "success" : hasOAuthToken ? "error" : "neutral"}`}>
              {routableOAuthCount > 0
                ? `OAuth ${routableOAuthCount} ok`
                : hasOAuthToken
                  ? "OAuth error"
                  : "OAuth not connected"}
            </span>
          ) : (
            <span className={`status ${keyCount > 0 ? "success" : "neutral"}`}>
              <KeyRound size={12} /> {keyCount} key{keyCount === 1 ? "" : "s"}
            </span>
          )}
          <span className="status neutral">
            <Layers size={12} /> {modelCount} model{modelCount === 1 ? "" : "s"}
          </span>
        </div>
        {provider.status === "cooldown" && provider.rateLimitedUntil ? (
          <small>Cooldown until {new Date(provider.rateLimitedUntil).toLocaleTimeString()}</small>
        ) : null}
        {provider.lastError ? <small title={provider.lastError}>Last error</small> : null}
      </div>
      <ChevronRight size={18} />
    </Link>
  );
}
