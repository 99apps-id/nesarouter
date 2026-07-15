import { isCloudflaredRunning, killCloudflared, setUnexpectedExitHandler, spawnQuickTunnel, getDownloadStatus } from "./cloudflared";
import { normalizeTunnelPort } from "./port";
import { readTunnelSettings, writeTunnelSettings } from "@/lib/store";

export { normalizeTunnelPort } from "./port";

const svc = {
  spawnInProgress: false,
  activeLocalPort: null as number | null,
  lastRestartAt: 0,
  cancelled: false,
  restoreAttempted: false
};

export function isTunnelReconnecting() {
  return svc.spawnInProgress;
}
export function getDownloadProgress() {
  return getDownloadStatus();
}

let watchdogTimer: ReturnType<typeof setInterval> | null = null;

async function respawn() {
  if (svc.spawnInProgress || svc.cancelled) return;
  if (Date.now() - svc.lastRestartAt < 30_000) return;
  const settings = await readTunnelSettings();
  if (!settings.enabled || !svc.activeLocalPort) return;
  svc.lastRestartAt = Date.now();
  try {
    const { tunnelUrl } = await spawnQuickTunnel(svc.activeLocalPort, async (url) => {
      await writeTunnelSettings({ tunnelUrl });
    });
    await writeTunnelSettings({ tunnelUrl });
  } catch {
    // next watchdog tick will retry
  }
}

/** Re-enable Cloudflare tunnel after NesaRouter process restart (once per boot). */
export async function restoreTunnelIfNeeded() {
  if (svc.restoreAttempted || svc.spawnInProgress) return;
  svc.restoreAttempted = true;
  const settings = await readTunnelSettings();
  if (!settings.enabled) return;
  let port: number;
  try {
    port = normalizeTunnelPort(settings.localPort, Number(process.env.PORT) || 20129);
  } catch {
    return;
  }
  if (isCloudflaredRunning()) {
    svc.activeLocalPort = port;
    setUnexpectedExitHandler(() => {
      void respawn();
    });
    if (!watchdogTimer) {
      watchdogTimer = setInterval(() => {
        void respawn();
      }, 60_000);
    }
    return;
  }
  // Background restore so /api/tunnel/status stays responsive.
  void enableTunnel(port).catch(() => {
    /* keep settings.enabled; UI shows stale/down */
  });
}

export async function enableTunnel(localPort?: number): Promise<{ tunnelUrl: string }> {
  const settings = await readTunnelSettings();
  const port = normalizeTunnelPort(localPort ?? settings.localPort, Number(process.env.PORT) || 20129);
  svc.cancelled = false;
  svc.activeLocalPort = port;
  svc.spawnInProgress = true;
  svc.restoreAttempted = true;
  try {
    if (isCloudflaredRunning() && settings.tunnelUrl) {
      await writeTunnelSettings({ enabled: true, localPort: port });
      setUnexpectedExitHandler(() => {
        void respawn();
      });
      if (!watchdogTimer) {
        watchdogTimer = setInterval(() => {
          void respawn();
        }, 60_000);
      }
      return { tunnelUrl: settings.tunnelUrl };
    }
    killCloudflared();
    setUnexpectedExitHandler(() => {
      void respawn();
    });
    const { tunnelUrl } = await spawnQuickTunnel(port, async (url) => {
      await writeTunnelSettings({ tunnelUrl });
    });
    await writeTunnelSettings({ enabled: true, tunnelUrl, localPort: port });
    if (!watchdogTimer) {
      watchdogTimer = setInterval(() => {
        void respawn();
      }, 60_000);
    }
    return { tunnelUrl };
  } finally {
    svc.spawnInProgress = false;
  }
}

export async function disableTunnel() {
  svc.cancelled = true;
  setUnexpectedExitHandler(null);
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  killCloudflared();
  await writeTunnelSettings({ enabled: false, tunnelUrl: "" });
  svc.activeLocalPort = null;
  return { ok: true };
}

export async function getTunnelStatus() {
  await restoreTunnelIfNeeded();
  const settings = await readTunnelSettings();
  const running = Boolean(settings.enabled && isCloudflaredRunning() && svc.activeLocalPort);
  return {
    enabled: running,
    settingsEnabled: settings.enabled,
    /** Live URL only when the process is actually up — avoids stale links looking active. */
    tunnelUrl: running ? settings.tunnelUrl : "",
    /** Previous URL when settings say enabled but process is down. */
    staleUrl: !running && settings.enabled && settings.tunnelUrl ? settings.tunnelUrl : "",
    running,
    localPort: settings.localPort,
    spawnInProgress: svc.spawnInProgress,
    download: getDownloadStatus()
  };
}
