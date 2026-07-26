import type Database from "better-sqlite3";
import { OAuthAccount } from "@/core/types";
import { encryptSecret, isRedactedSecret } from "@/lib/crypto";

/**
 * Keep legacy primary OAuth columns synchronized with the first multi-account
 * entry. Older installs and specialty adapters still read these columns.
 */
export function syncPrimaryOAuthColumns(
  database: Database.Database,
  providerId: string,
  accounts: OAuthAccount[]
) {
  const primary = accounts[0];
  const encrypted = (value?: string) =>
    value && !isRedactedSecret(value) ? encryptSecret(value.trim()) : null;
  database.prepare(`UPDATE providers SET
    oauth_access_token_encrypted = ?,
    oauth_refresh_token_encrypted = ?,
    oauth_token_expires_at = ?,
    oauth_last_refresh_at = ?,
    oauth_copilot_token_encrypted = ?,
    oauth_copilot_token_expires_at = ?,
    oauth_project_id = ?,
    oauth_device_client_id = ?,
    oauth_device_client_secret_encrypted = ?,
    oauth_machine_id = ?,
    oauth_profile_arn = ?
    WHERE id = ?`).run(
    encrypted(primary?.oauthAccessToken),
    encrypted(primary?.oauthRefreshToken),
    primary?.oauthTokenExpiresAt ?? null,
    primary?.oauthLastRefreshAt ?? null,
    encrypted(primary?.oauthCopilotToken),
    primary?.oauthCopilotTokenExpiresAt ?? null,
    primary?.oauthProjectId ?? null,
    primary?.oauthDeviceClientId ?? null,
    encrypted(primary?.oauthDeviceClientSecret),
    primary?.oauthMachineId ?? null,
    primary?.oauthProfileArn ?? null,
    providerId
  );
}

export function syncProviderOAuthConnectionStatus(
  database: Database.Database,
  providerId: string,
  accounts: OAuthAccount[]
) {
  const withToken = accounts.filter((account) => Boolean(account.oauthAccessToken || account.oauthCopilotToken));
  const routable = withToken.filter(
    (account) => account.connectionStatus !== "error" && account.connectionStatus !== "no_subscription"
  );
  const onlyNoSubscription =
    !routable.length &&
    withToken.length > 0 &&
    withToken.every((account) => account.connectionStatus === "no_subscription");
  const anyNoSubscription = withToken.some((account) => account.connectionStatus === "no_subscription");
  const status = routable.length
    ? "connected"
    : onlyNoSubscription ||
        (anyNoSubscription && !withToken.some((account) => account.connectionStatus === "error"))
      ? "no_subscription"
      : withToken.length
        ? "error"
        : "unknown";
  const lastError = routable.length
    ? null
    : withToken.find((account) => account.lastError)?.lastError ?? null;
  database
    .prepare("UPDATE providers SET connection_status = ?, last_checked_at = ?, last_error = ? WHERE id = ?")
    .run(status, new Date().toISOString(), lastError, providerId);
}
