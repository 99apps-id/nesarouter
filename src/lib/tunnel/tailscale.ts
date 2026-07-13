import { execFileSync, spawn } from "node:child_process";
import os from "node:os";
import { readTunnelSettings, writeTunnelSettings } from "@/lib/store";

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

function findTailscaleBin(): string | null {
  const candidates = IS_WINDOWS
    ? ["C:\\Program Files\\Tailscale\\tailscale.exe", "C:\\Program Files (x86)\\Tailscale\\tailscale.exe"]
    : ["/usr/bin/tailscale", "/usr/local/bin/tailscale", "/opt/homebrew/bin/tailscale"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["version"], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, timeout: 3000 });
      return c;
    } catch {}
  }
  try {
    execFileSync("tailscale", ["version"], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, timeout: 3000 });
    return "tailscale";
  } catch {}
  return null;
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

function discoverUrl(): string {
  const bin = findTailscaleBin();
  if (!bin) return "";
  const data = runJson(bin, ["status", "--json"]);
  const host = String(data?.Self?.DNSName || "").replace(/\.$/, "");
  return host ? `https://${host}/` : "";
}

function runServeOrFunnel(bin: string, mode: "serve" | "funnel", localPort: number): Promise<{ url: string }> {
  // Modern CLI (1.8x+): `tailscale serve --bg <port>` / `tailscale funnel --bg <port>`
  const args = mode === "funnel"
    ? ["funnel", "--bg", String(localPort)]
    : ["serve", "--bg", String(localPort)];

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill(); } catch {}
      fn();
    };

    const timer = setTimeout(() => {
      const url = discoverUrl();
      if (url) finish(() => resolve({ url }));
      else finish(() => reject(new TailscaleSetupError(
        `Tailscale ${mode} timed out. ${output.trim() || "No output from CLI."}`,
        "failed"
      )));
    }, 20_000);

    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const serveDisabled = /Serve is not enabled/i.test(output);
      const funnelDisabled = /Funnel is not enabled/i.test(output);
      if (serveDisabled || funnelDisabled) {
        const enableUrl = output.match(/https:\/\/login\.tailscale\.com\/[^\s]+/)?.[0];
        finish(() => reject(new TailscaleSetupError(
          serveDisabled
            ? "Tailscale Serve is not enabled on your tailnet. Open the enable link, then try again."
            : "Tailscale Funnel is not enabled on your tailnet. Open the enable link, then try again.",
          serveDisabled ? "serve_disabled" : "funnel_disabled",
          enableUrl
        )));
        return;
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => finish(() => reject(err)));
    child.on("exit", (code) => {
      if (settled) return;
      const url = discoverUrl();
      if (url && (code === 0 || code === null)) {
        finish(() => resolve({ url }));
        return;
      }
      finish(() => reject(new TailscaleSetupError(
        `tailscale ${mode} failed (code ${code}): ${output.trim() || "no output"}`,
        "failed"
      )));
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

  // Clear previous config so re-enable is deterministic.
  try { execFileSync(bin, ["serve", "reset"], { stdio: "ignore", windowsHide: true, timeout: 8_000 }); } catch {}
  try { execFileSync(bin, ["funnel", "reset"], { stdio: "ignore", windowsHide: true, timeout: 8_000 }); } catch {}

  const result = await runServeOrFunnel(bin, mode, localPort);
  const url = result.url || discoverUrl();
  await writeTunnelSettings({ tailscaleEnabled: true, tailscaleUrl: url });
  return { url };
}

export async function disableTailscale() {
  const bin = findTailscaleBin();
  if (bin) {
    try { execFileSync(bin, ["serve", "reset"], { stdio: "ignore", windowsHide: true, timeout: 10_000 }); } catch {}
    try { execFileSync(bin, ["funnel", "reset"], { stdio: "ignore", windowsHide: true, timeout: 10_000 }); } catch {}
  }
  await writeTunnelSettings({ tailscaleEnabled: false, tailscaleUrl: "" });
  return { ok: true };
}

export async function getTailscaleStatus() {
  const settings = await readTunnelSettings();
  return {
    installed: isTailscaleInstalled(),
    loggedIn: isTailscaleLoggedIn(),
    running: isTailscaleRunning(),
    enabled: settings.tailscaleEnabled,
    url: settings.tailscaleUrl
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
      try { child.kill(); } catch {}
      fn();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new Error("tailscale login timed out without a login URL. Try running `tailscale login` in a terminal.")));
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
