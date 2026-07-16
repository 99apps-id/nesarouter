import { execFileSync, spawn } from "node:child_process";
import os from "node:os";
import { readTunnelSettings, writeTunnelSettings } from "@/lib/store";
import { normalizeTunnelPort } from "@/lib/tunnel/port";

const IS_WINDOWS = os.platform() === "win32";

export class TailscaleSetupError extends Error {
  enableUrl?: string;
  kind: "not_installed" | "not_logged_in" | "serve_disabled" | "funnel_disabled" | "failed";

  constructor(message: string, kind: TailscaleSetupError["kind"], enableUrl?: string) {
    super(message);
    this.name = "TailscaleSetupError";
    this.kind = kind;
    this.enableUrl = enableUrl;
  }
}

const restoreState = { attempted: false };

function findTailscaleBin(): string | null {
  const candidates = IS_WINDOWS
    ? ["C:\\Program Files\\Tailscale\\tailscale.exe", "C:\\Program Files (x86)\\Tailscale\\tailscale.exe"]
    : ["/usr/bin/tailscale", "/usr/local/bin/tailscale", "/opt/homebrew/bin/tailscale"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["version"], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, timeout: 3000 });
      return c;
    } catch {
      /* try next */
    }
  }
  try {
    execFileSync("tailscale", ["version"], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, timeout: 3000 });
    return "tailscale";
  } catch {
    return null;
  }
}

function runJson(bin: string, args: string[], timeout = 5000): any | null {
  try {
    const stdout = execFileSync(bin, args, { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, timeout });
    return JSON.parse(stdout.toString());
  } catch {
    return null;
  }
}

export function getTailscaleBin() {
  return findTailscaleBin();
}

export function isTailscaleInstalled() {
  return findTailscaleBin() !== null;
}

export function isTailscaleLoggedIn() {
  const bin = findTailscaleBin();
  if (!bin) return false;
  const data = runJson(bin, ["status", "--json"]);
  return Boolean(data?.Self?.UserID && data.Self.UserID !== 0);
}

export function isTailscaleRunning() {
  const bin = findTailscaleBin();
  if (!bin) return false;
  try {
    execFileSync(bin, ["status"], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function dnsFallbackUrl(): string {
  const bin = findTailscaleBin();
  if (!bin) return "";
  const data = runJson(bin, ["status", "--json"]);
  const host = String(data?.Self?.DNSName || "").replace(/\.$/, "");
  return host ? `https://${host}` : "";
}

/** Pull a public/serve URL from `tailscale serve|funnel status --json` shapes. */
export function parseTailscaleServeStatus(data: unknown): { url: string; active: boolean } {
  if (!data || typeof data !== "object") return { url: "", active: false };
  const root = data as Record<string, unknown>;
  const candidates: string[] = [];

  const collectWeb = (web: unknown) => {
    if (!web || typeof web !== "object") return;
    for (const key of Object.keys(web as object)) {
      if (/^https?:\/\//i.test(key)) candidates.push(key.replace(/\/$/, ""));
      const entry = (web as Record<string, unknown>)[key];
      if (entry && typeof entry === "object") {
        const handlers = (entry as { Handlers?: unknown }).Handlers;
        if (handlers && typeof handlers === "object" && Object.keys(handlers as object).length > 0) {
          if (/^https?:\/\//i.test(key)) candidates.push(key.replace(/\/$/, ""));
        }
      }
    }
  };

  collectWeb(root.Web);
  if (root.Background && typeof root.Background === "object") {
    collectWeb((root.Background as { Web?: unknown }).Web);
  }
  if (root.Foreground && typeof root.Foreground === "object") {
    collectWeb((root.Foreground as { Web?: unknown }).Web);
  }

  // Funnel status sometimes nests under Funnel / AllowFunnel maps keyed by host.
  for (const key of ["Funnel", "AllowFunnel", "HTTPSConfigs"]) {
    const block = root[key];
    if (block && typeof block === "object") {
      for (const host of Object.keys(block as object)) {
        if (host.includes(".")) candidates.push(host.startsWith("http") ? host.replace(/\/$/, "") : `https://${host.replace(/\/$/, "")}`);
      }
    }
  }

  const url = candidates[0] || "";
  const active = Boolean(url) || Boolean(root.TCP && typeof root.TCP === "object" && Object.keys(root.TCP as object).length);
  return { url, active: active || Boolean(url) };
}

function liveServeStatus(mode: "serve" | "funnel"): { url: string; active: boolean } {
  const bin = findTailscaleBin();
  if (!bin) return { url: "", active: false };
  const primary = runJson(bin, [mode, "status", "--json"]);
  return parseTailscaleServeStatus(primary);
}

function discoverUrl(mode: "serve" | "funnel" = "serve"): string {
  const live = liveServeStatus(mode);
  if (live.url) return live.url;
  return dnsFallbackUrl();
}

function runServeOrFunnel(bin: string, mode: "serve" | "funnel", localPort: number): Promise<{ url: string }> {
  // Modern CLI (1.8x+): `tailscale serve --bg <port>` / `tailscale funnel --bg <port>`
  const args = mode === "funnel" ? ["funnel", "--bg", String(localPort)] : ["serve", "--bg", String(localPort)];

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      fn();
    };

    const timer = setTimeout(() => {
      const url = discoverUrl(mode);
      if (url) finish(() => resolve({ url }));
      else
        finish(() =>
          reject(
            new TailscaleSetupError(
              `Tailscale ${mode} timed out. ${output.trim() || "No output from CLI."}`,
              "failed"
            )
          )
        );
    }, 20_000);

    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const serveDisabled = /Serve is not enabled/i.test(output);
      const funnelDisabled = /Funnel is not enabled/i.test(output);
      if (serveDisabled || funnelDisabled) {
        const enableUrl = output.match(/https:\/\/login\.tailscale\.com\/[^\s]+/)?.[0];
        finish(() =>
          reject(
            new TailscaleSetupError(
              serveDisabled
                ? "Tailscale Serve is not enabled on your tailnet. Open the enable link, then try again."
                : "Tailscale Funnel is not enabled on your tailnet. Open the enable link, then try again.",
              serveDisabled ? "serve_disabled" : "funnel_disabled",
              enableUrl
            )
          )
        );
        return;
      }

      // Some CLI builds print the URL directly.
      const printed = output.match(/https:\/\/[a-z0-9.-]+\.ts\.net[^\s]*/i)?.[0];
      if (printed) {
        finish(() => resolve({ url: printed.replace(/\/$/, "") }));
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => finish(() => reject(err)));
    child.on("exit", (code) => {
      if (settled) return;
      const url = discoverUrl(mode);
      if (url && (code === 0 || code === null)) {
        finish(() => resolve({ url }));
        return;
      }
      finish(() =>
        reject(
          new TailscaleSetupError(
            `tailscale ${mode} failed (code ${code}): ${output.trim() || "no output"}`,
            "failed"
          )
        )
      );
    });
  });
}

/**
 * Enable Tailscale serve (private tailnet) or funnel (public) for the local port.
 */
export async function enableTailscale(localPort: number, mode: "serve" | "funnel"): Promise<{ url: string }> {
  const bin = findTailscaleBin();
  if (!bin) throw new TailscaleSetupError("Tailscale binary not found. Install Tailscale first.", "not_installed");
  if (!isTailscaleLoggedIn()) {
    throw new TailscaleSetupError("Tailscale is not logged in. Click Log in, then try Enable again.", "not_logged_in");
  }

  const port = normalizeTunnelPort(localPort, Number(process.env.PORT) || 20129);

  // Clear previous config so re-enable is deterministic.
  try {
    execFileSync(bin, ["serve", "reset"], { stdio: "ignore", windowsHide: true, timeout: 8_000 });
  } catch {
    /* ignore */
  }
  try {
    execFileSync(bin, ["funnel", "reset"], { stdio: "ignore", windowsHide: true, timeout: 8_000 });
  } catch {
    /* ignore */
  }

  const result = await runServeOrFunnel(bin, mode, port);
  const url = result.url || discoverUrl(mode);
  await writeTunnelSettings({
    tailscaleEnabled: true,
    tailscaleUrl: url,
    tailscaleMode: mode,
    localPort: port
  });
  return { url };
}

export async function disableTailscale() {
  const bin = findTailscaleBin();
  if (bin) {
    try {
      execFileSync(bin, ["serve", "reset"], { stdio: "ignore", windowsHide: true, timeout: 10_000 });
    } catch {
      /* ignore */
    }
    try {
      execFileSync(bin, ["funnel", "reset"], { stdio: "ignore", windowsHide: true, timeout: 10_000 });
    } catch {
      /* ignore */
    }
    const serve = liveServeStatus("serve");
    const funnel = liveServeStatus("funnel");
    if (serve.active || funnel.active) {
      throw new TailscaleSetupError("Tailscale Serve/Funnel is still active after reset.", "failed");
    }
  }
  await writeTunnelSettings({ tailscaleEnabled: false, tailscaleUrl: "" });
  return { ok: true };
}

/** Re-apply serve/funnel after NesaRouter restart when settings say it was enabled. */
export async function restoreTailscaleIfNeeded() {
  if (restoreState.attempted) return;
  restoreState.attempted = true;
  const settings = await readTunnelSettings();
  if (!settings.tailscaleEnabled) return;
  if (!isTailscaleInstalled() || !isTailscaleLoggedIn()) return;

  const mode = settings.tailscaleMode === "funnel" ? "funnel" : "serve";
  let port: number;
  try {
    port = normalizeTunnelPort(settings.localPort, Number(process.env.PORT) || 20129);
  } catch {
    return;
  }

  const live = liveServeStatus(mode);
  if (live.active) {
    if (live.url && live.url !== settings.tailscaleUrl) {
      await writeTunnelSettings({ tailscaleUrl: live.url, tailscaleMode: mode });
    }
    return;
  }

  void enableTailscale(port, mode).catch(() => {
    /* keep settings; UI shows stale/down */
  });
}

export async function getTailscaleStatus() {
  await restoreTailscaleIfNeeded();
  const settings = await readTunnelSettings();
  const mode = settings.tailscaleMode === "funnel" ? "funnel" : "serve";
  const installed = isTailscaleInstalled();
  const loggedIn = installed && isTailscaleLoggedIn();
  const daemonRunning = installed && isTailscaleRunning();
  const live = installed ? liveServeStatus(mode) : { url: "", active: false };
  const url = live.url || (live.active ? dnsFallbackUrl() : "");
  const active = Boolean(settings.tailscaleEnabled && daemonRunning && (live.active || Boolean(live.url)));

  return {
    installed,
    loggedIn,
    running: daemonRunning,
    enabled: active,
    settingsEnabled: settings.tailscaleEnabled,
    mode,
    url: active ? url || settings.tailscaleUrl : "",
    staleUrl: settings.tailscaleEnabled && !active && settings.tailscaleUrl ? settings.tailscaleUrl : "",
    localPort: settings.localPort
  };
}

export function startLogin() {
  const bin = findTailscaleBin();
  if (!bin) throw new TailscaleSetupError("Tailscale binary not found.", "not_installed");
  const child = spawn(bin, ["login"], { detached: true, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise<{ loginUrl: string }>((resolve, reject) => {
    let captured = "";
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      fn();
    };
    const timer = setTimeout(() => {
      finish(() =>
        reject(new Error("tailscale login timed out without a login URL. Try running `tailscale login` in a terminal."))
      );
    }, 30_000);
    const handle = (data: Buffer) => {
      captured += data.toString();
      const match = captured.match(/https:\/\/login\.tailscale\.com\/[^\s]+/);
      if (match) finish(() => resolve({ loginUrl: match[0] }));
    };
    child.stdout?.on("data", handle);
    child.stderr?.on("data", handle);
    child.on("error", (err) => finish(() => reject(err)));
    child.on("exit", (code) => {
      if (!captured.match(/https:\/\/login\.tailscale\.com\//)) {
        finish(() => reject(new Error(`tailscale login exited (code ${code}) without printing a login URL.`)));
      }
    });
  });
}
