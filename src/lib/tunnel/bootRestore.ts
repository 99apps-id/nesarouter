/**
 * Node-only remote-access restore after process restart.
 * Kept separate from instrumentation.ts so Edge/webpack does not statically
 * pull better-sqlite3 via store → tunnel manager.
 */
export async function restoreRemoteAccess() {
  const { restoreTunnelIfNeeded } = await import("@/lib/tunnel/manager");
  const { restoreTailscaleIfNeeded } = await import("@/lib/tunnel/tailscale");
  await restoreTunnelIfNeeded();
  await restoreTailscaleIfNeeded();
}
