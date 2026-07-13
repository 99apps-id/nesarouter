import { ensureCloudflared, isCloudflaredRunning, killCloudflared, setUnexpectedExitHandler, spawnQuickTunnel, getDownloadStatus } from "./cloudflared";
import { readTunnelSettings, writeTunnelSettings } from "@/lib/store";

const svc = {
  spawnInProgress: false,
  activeLocalPort: null as number | null,
  lastRestartAt: 0,
  cancelled: false
};

export function isTunnelReconnecting() { return svc.spawnInProgress; }
export function getDownloadProgress() { return getDownloadStatus(); }

let watchdogTimer: ReturnType<typeof setInterval> | null = null;

async function respawn() {
  if (svc.spawnInProgress) return;
  if (Date.now() - svc.lastRestartAt < 30_000) return;
  const settings = await readTunnelSettings();
  if (!settings.enabled || !svc.activeLocalPort) return;
  svc.lastRestartAt = Date.now();
  try {
    const { tunnelUrl } = await spawnQuickTunnel(svc.activeLocalPort, async (url) => {
      await writeTunnelSettings({ tunnelUrl });
    });
    await writeTunnelSettings({ tunnelUrl });
  } catch (err) {
    // next watchdog tick will retry
  }
}

export async function enableTunnel(localPort?: number): Promise<{ tunnelUrl: string }> {
  const settings = await readTunnelSettings();
  const port = localPort ?? settings.localPort;
  svc.cancelled = false;
  svc.activeLocalPort = port;
  svc.spawnInProgress = true;
  try {
    if (isCloudflaredRunning() && settings.tunnelUrl) {
      await writeTunnelSettings({ enabled: true });
      return { tunnelUrl: settings.tunnelUrl };
    }
    killCloudflared();
    setUnexpectedExitHandler(() => { void respawn(); });
    const { tunnelUrl } = await spawnQuickTunnel(port, async (url) => {
      await writeTunnelSettings({ tunnelUrl });
    });
    await writeTunnelSettings({ enabled: true, tunnelUrl, localPort: port });
    if (!watchdogTimer) {
      watchdogTimer = setInterval(() => { void respawn(); }, 60_000);
    }
    return { tunnelUrl };
  } finally {
    svc.spawnInProgress = false;
  }
}

export async function disableTunnel() {
  svc.cancelled = true;
  setUnexpectedExitHandler(null);
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
  killCloudflared();
  await writeTunnelSettings({ enabled: false, tunnelUrl: "" });
  svc.activeLocalPort = null;
  return { ok: true };
}

export async function getTunnelStatus() {
  const settings = await readTunnelSettings();
  const running = settings.enabled ? isCloudflaredRunning() : false;
  return {
    enabled: settings.enabled && running,
    settingsEnabled: settings.enabled,
    tunnelUrl: settings.tunnelUrl,
    running,
    localPort: settings.localPort,
    spawnInProgress: svc.spawnInProgress,
    download: getDownloadStatus()
  };
}
