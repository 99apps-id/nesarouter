import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import os from "node:os";
import { execSync, spawn } from "node:child_process";
import { getDataDir } from "@/lib/store";

const BIN_DIR = path.join(getDataDir(), "bin");
const IS_WINDOWS = os.platform() === "win32";
const BINARY_NAME = "cloudflared";
const BIN_NAME = IS_WINDOWS ? `${BINARY_NAME}.exe` : BINARY_NAME;
const BIN_PATH = path.join(BIN_DIR, BIN_NAME);

const GITHUB_BASE_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download";

const PLATFORM_MAPPINGS: Record<string, Record<string, string>> = {
  darwin: { x64: "cloudflared-darwin-amd64.tgz", arm64: "cloudflared-darwin-arm64.tgz" },
  win32: { x64: "cloudflared-windows-amd64.exe", arm64: "cloudflared-windows-arm64.exe" },
  linux: { x64: "cloudflared-linux-amd64", arm64: "cloudflared-linux-arm64" }
};

const PLATFORM_FALLBACK: Record<string, string> = {
  darwin: "cloudflared-darwin-amd64.tgz",
  win32: "cloudflared-windows-386.exe",
  linux: "cloudflared-linux-amd64"
};

function getDownloadUrl() {
  const platform = os.platform();
  const arch = os.arch();
  const mapping = PLATFORM_MAPPINGS[platform];
  if (!mapping) throw new Error(`Unsupported platform: ${platform}`);
  const name = mapping[arch] ?? PLATFORM_FALLBACK[platform];
  return `${GITHUB_BASE_URL}/${name}`;
}

const dlState = { downloading: false, progress: 0 };
export function getDownloadStatus() {
  return { downloading: dlState.downloading, progress: dlState.progress };
}

function downloadFile(url: string, dest: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(response.headers.location ?? "", dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }
      const total = parseInt(response.headers["content-length"] ?? "0", 10) || 0;
      let received = 0;
      dlState.downloading = true;
      dlState.progress = 0;
      response.on("data", (chunk) => {
        received += chunk.length;
        if (total > 0) dlState.progress = Math.round((received / total) * 100);
      });
      response.pipe(file);
      file.on("finish", () => {
        dlState.downloading = false;
        dlState.progress = 100;
        file.close(() => resolve(dest));
      });
      file.on("error", (err) => {
        dlState.downloading = false;
        dlState.progress = 0;
        try { file.close(); } catch {}
        try { fs.unlinkSync(dest); } catch {}
        reject(err);
      });
    }).on("error", (err) => {
      dlState.downloading = false;
      try { file.close(); } catch {}
      try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

const MIN_BINARY_SIZE = 1024 * 1024;

function isValidBinary(filePath: string) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < MIN_BINARY_SIZE) return false;
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const magic = buf.toString("hex");
    if (IS_WINDOWS) return magic.startsWith("4d5a");
    if (os.platform() === "darwin") return magic.startsWith("cffaedfe") || magic.startsWith("cefaedfe");
    return magic.startsWith("7f454c46");
  } catch {
    return false;
  }
}

let downloadPromise: Promise<string> | null = null;

export async function ensureCloudflared(): Promise<string> {
  if (downloadPromise) return downloadPromise;
  downloadPromise = (async () => {
    if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });
    const tmpPath = `${BIN_PATH}.tmp`;
    if (fs.existsSync(tmpPath)) { try { fs.unlinkSync(tmpPath); } catch {} }
    if (fs.existsSync(BIN_PATH)) {
      if (!isValidBinary(BIN_PATH)) {
        fs.unlinkSync(BIN_PATH);
      } else {
        if (!IS_WINDOWS) fs.chmodSync(BIN_PATH, "755");
        return BIN_PATH;
      }
    }
    const url = getDownloadUrl();
    const isArchive = url.endsWith(".tgz");
    const downloadDest = isArchive ? path.join(BIN_DIR, "cloudflared.tgz.tmp") : tmpPath;
    await downloadFile(url, downloadDest);
    if (isArchive) {
      execSync(`tar -xzf "${downloadDest}" -C "${BIN_DIR}"`, { stdio: "pipe", windowsHide: true });
      try { fs.unlinkSync(downloadDest); } catch {}
      // the extracted binary may be named "cloudflared" without .exe
      const extracted = path.join(BIN_DIR, "cloudflared");
      if (fs.existsSync(extracted) && IS_WINDOWS) fs.renameSync(extracted, BIN_PATH);
    } else {
      fs.renameSync(downloadDest, BIN_PATH);
    }
    if (!IS_WINDOWS) fs.chmodSync(BIN_PATH, "755");
    return BIN_PATH;
  })().finally(() => { downloadPromise = null; });
  return downloadPromise;
}

let cloudflaredProcess: ReturnType<typeof spawn> | null = null;
const intentionalKills = new WeakSet<ReturnType<typeof spawn>>();
const pidFile = path.join(BIN_DIR, "cloudflared.pid");

function savePid(pid: number) {
  try { fs.writeFileSync(pidFile, String(pid)); } catch {}
}
function loadPid(): number | null {
  try { if (fs.existsSync(pidFile)) return parseInt(fs.readFileSync(pidFile, "utf8"), 10); } catch {}
  return null;
}
function clearPid() {
  try { if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile); } catch {}
}

export function isCloudflaredRunning() {
  const pid = loadPid();
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

let unexpectedExitHandler: (() => void) | null = null;
export function setUnexpectedExitHandler(handler: (() => void) | null) {
  unexpectedExitHandler = handler;
}

function parseQuickTunnelUrl(message: string): string | null {
  const regex = /https:\/\/([a-z0-9-]+)\.trycloudflare\.com/gi;
  const candidates: string[] = [];
  for (const match of message.matchAll(regex)) {
    if (match[1] === "api") continue;
    candidates.push(`https://${match[1]}.trycloudflare.com`);
  }
  return candidates.length ? candidates[candidates.length - 1] : null;
}

export async function spawnQuickTunnel(localPort: number, onUrlUpdate?: (url: string) => void): Promise<{ tunnelUrl: string }> {
  const binaryPath = await ensureCloudflared();
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nesa-cloudflared-"));
  const configPath = path.join(configDir, "config.yml");
  fs.writeFileSync(configPath, "# nesa quick-tunnel config placeholder\n", "utf8");

  let isCleaned = false;
  const cleanup = () => {
    if (isCleaned) return;
    isCleaned = true;
    try { fs.rmSync(configDir, { recursive: true, force: true }); } catch {}
  };

  const child = spawn(binaryPath, ["tunnel", "--url", `http://127.0.0.1:${localPort}`, "--config", configPath, "--no-autoupdate", "--retries", "99"], {
    detached: false,
    windowsHide: true,
    cwd: os.tmpdir(),
    env: { ...process.env, TUNNEL_TRANSPORT_PROTOCOL: "http2" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  cloudflaredProcess = child;
  savePid(child.pid ?? 0);

  return new Promise((resolve, reject) => {
    let resolved = false;
    let lastUrl: string | null = null;
    let logTail = "";

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      intentionalKills.add(child);
      try { child.kill(); } catch {}
      if (cloudflaredProcess === child) cloudflaredProcess = null;
      if (loadPid() === child.pid) clearPid();
      cleanup();
      reject(new Error(`Quick tunnel timed out. Last log: ${logTail.slice(-800) || "(empty)"}`));
    }, 90_000);

    const handleLog = (data: Buffer) => {
      const msg = data.toString();
      logTail = (logTail + msg).slice(-4000);
      const tunnelUrl = parseQuickTunnelUrl(msg);
      if (!tunnelUrl) return;
      if (!resolved) {
        resolved = true;
        lastUrl = tunnelUrl;
        clearTimeout(timeout);
        cleanup();
        resolve({ tunnelUrl });
        return;
      }
      if (tunnelUrl !== lastUrl) {
        lastUrl = tunnelUrl;
        onUrlUpdate?.(tunnelUrl);
      }
    };

    child.stdout?.on("data", handleLog);
    child.stderr?.on("data", handleLog);

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (cloudflaredProcess === child) cloudflaredProcess = null;
      if (loadPid() === child.pid) clearPid();
      cleanup();
      reject(err);
    });

    child.on("exit", (code) => {
      if (cloudflaredProcess === child) cloudflaredProcess = null;
      if (loadPid() === child.pid) clearPid();
      if (intentionalKills.has(child)) {
        intentionalKills.delete(child);
        clearTimeout(timeout);
        cleanup();
        if (!resolved) { resolved = true; reject(new Error("cloudflared killed")); }
        return;
      }
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        const tail = logTail.slice(-600).trim() || "(empty)";
        reject(new Error(`cloudflared exited (code ${code}). Last log: ${tail}`));
        return;
      }
      unexpectedExitHandler?.();
      cleanup();
    });
  });
}

export function killCloudflared() {
  const managed = cloudflaredProcess;
  if (managed) intentionalKills.add(managed);
  try { managed?.kill(); } catch {}
  cloudflaredProcess = null;
  const pid = loadPid();
  if (pid) {
    try { process.kill(pid); } catch {}
    clearPid();
  }
}
