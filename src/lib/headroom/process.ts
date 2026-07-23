import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { getDataDir } from "@/lib/store";
import { buildHeadroomLaunchSpec, findHeadroomBinary, findPython310, HEADROOM_COMPRESSION_EXTRAS, HEADROOM_PROCESS_ENV, HeadroomExtra, EXTRA_MARKERS } from "./detect";

const HEADROOM_DIR = path.join(getDataDir(), "headroom");
const PID_FILE = path.join(HEADROOM_DIR, "proxy.pid");
const LOG_FILE = path.join(HEADROOM_DIR, "proxy.log");
const INSTALL_LOG_FILE = path.join(HEADROOM_DIR, "install.log");
const VENV_DIR = path.join(HEADROOM_DIR, "venv");
const DEFAULT_PORT = 8787;
const STARTUP_TIMEOUT_MS = 8000;

function ensureDir() {
  if (!fs.existsSync(HEADROOM_DIR)) fs.mkdirSync(HEADROOM_DIR, { recursive: true });
}

export function headroomVenvPython(
  venvDir = VENV_DIR,
  platform = process.platform
) {
  return platform === "win32"
    ? path.win32.join(venvDir, "Scripts", "python.exe")
    : path.posix.join(venvDir.replaceAll("\\", "/"), "bin", "python");
}

function managedHeadroomPython() {
  const python = headroomVenvPython();
  if (!fs.existsSync(python)) return null;
  try {
    execFileSync(python, ["-m", "pip", "show", "headroom-ai"], {
      stdio: "ignore",
      timeout: 8000,
      windowsHide: true,
      env: HEADROOM_PROCESS_ENV
    });
    return python;
  } catch {
    return null;
  }
}

function ensureManagedVenv(systemPython: string) {
  const managed = headroomVenvPython();
  if (fs.existsSync(managed)) return managed;
  ensureDir();
  execFileSync(systemPython, ["-m", "venv", VENV_DIR], {
    stdio: "ignore",
    timeout: 120_000,
    windowsHide: true,
    env: HEADROOM_PROCESS_ENV
  });
  if (!fs.existsSync(managed)) throw new Error("Python virtual environment could not be created.");
  return managed;
}

function isPidAlive(pid: number) {
  if (!pid || typeof pid !== "number") return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid(): number | null {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    const raw = fs.readFileSync(PID_FILE, "utf8");
    if (raw.trim().startsWith("{")) return Number(JSON.parse(raw).pid) || null;
    return parseInt(raw, 10);
  } catch {}
  return null;
}

function writePid(pid: number, command: string, args: string[]) {
  ensureDir();
  fs.writeFileSync(PID_FILE, JSON.stringify({ pid, command, args, startedAt: new Date().toISOString() }));
}
function clearPid() { try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch {} }

export function getManagedPid() {
  const pid = readPid();
  return pid && isPidAlive(pid) && isHeadroomProcess(pid) ? pid : null;
}

function isHeadroomProcess(pid: number) {
  try {
    let commandLine = "";
    if (process.platform === "win32") {
      commandLine = execFileSync("powershell", ["-NoProfile", "-Command", `(Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\").CommandLine`], { encoding: "utf8", timeout: 3000, windowsHide: true });
    } else if (process.platform === "linux") {
      commandLine = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ");
    } else {
      commandLine = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 3000 });
    }
    return /(?:^|[\\/\s])headroom(?:\.exe)?(?:\s|$)|headroom\.cli/i.test(commandLine);
  } catch {
    return false;
  }
}

function extrasProxyArgs(opts: { codeAware: boolean; kompress: boolean }) {
  const args: string[] = [];
  if (opts.codeAware) args.push("--code-aware");
  if (opts.kompress === false) args.push("--disable-kompress");
  return args;
}

export interface StartOptions {
  port?: number;
  codeAware?: boolean;
  kompress?: boolean;
}

export function normalizeHeadroomPort(value: unknown): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}

export async function startHeadroomProxy(opts: StartOptions = {}): Promise<{ pid: number; alreadyRunning: boolean }> {
  const safePort = normalizeHeadroomPort(opts.port);
  const binary = findHeadroomBinary();
  const python = binary ? null : managedHeadroomPython() ?? findPython310();
  const launch = buildHeadroomLaunchSpec(binary, python);
  if (!launch) {
    const err = new Error("Headroom CLI not installed (run `pip install headroom-ai[proxy]`)");
    (err as any).code = "NOT_INSTALLED";
    throw err;
  }
  const existing = getManagedPid();
  if (existing) return { pid: existing, alreadyRunning: true };

  ensureDir();
  const outFd = fs.openSync(LOG_FILE, "a");
  const args = [...launch.prefixArgs, "proxy", "--port", String(safePort), ...extrasProxyArgs({ codeAware: opts.codeAware ?? false, kompress: opts.kompress ?? true })];
  const child = spawn(launch.command, args, {
    stdio: ["ignore", outFd, outFd],
    detached: true,
    windowsHide: true,
    env: HEADROOM_PROCESS_ENV
  });

  if (!child.pid) {
    fs.closeSync(outFd);
    const err = new Error("Failed to spawn headroom proxy");
    (err as any).code = "SPAWN_FAILED";
    throw err;
  }

  child.unref();
  writePid(child.pid, launch.command, args);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      if (isPidAlive(child.pid!)) resolve();
      else reject(new Error("headroom proxy exited during startup — see proxy.log"));
    }, STARTUP_TIMEOUT_MS);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearPid();
      fs.closeSync(outFd);
      const e = new Error(`Failed to spawn headroom proxy: ${error.message}`);
      (e as any).code = "SPAWN_FAILED";
      reject(e);
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearPid();
      fs.closeSync(outFd);
      const e = new Error(`headroom proxy exited early (code=${code}) — see proxy.log`);
      (e as any).code = "EARLY_EXIT";
      reject(e);
    });
  });

  fs.closeSync(outFd);
  return { pid: child.pid, alreadyRunning: false };
}

export function stopHeadroomProxy() {
  const pid = getManagedPid();
  if (!pid) return { stopped: false, reason: "not_running" };
  try {
    process.kill(pid, "SIGTERM");
    setTimeout(() => { if (isPidAlive(pid)) { try { process.kill(pid, "SIGKILL"); } catch {} } }, 2000);
    clearPid();
    return { stopped: true, pid };
  } catch (e) {
    clearPid();
    throw new Error(`Failed to stop headroom proxy: ${(e as Error).message}`);
  }
}

export async function restartHeadroomProxy(opts: StartOptions = {}) {
  const pid = getManagedPid();
  if (pid) {
    try { process.kill(pid, "SIGTERM"); } catch {}
    for (let i = 0; i < 30 && isPidAlive(pid); i++) await new Promise((r) => setTimeout(r, 100));
    if (isPidAlive(pid)) { try { process.kill(pid, "SIGKILL"); } catch {} await new Promise((r) => setTimeout(r, 300)); }
    clearPid();
  }
  return startHeadroomProxy(opts);
}

export function getHeadroomLogTail(maxLines = 200) {
  try {
    if (!fs.existsSync(LOG_FILE)) return "";
    const content = fs.readFileSync(LOG_FILE, "utf8");
    return content.split(/\r?\n/).filter(Boolean).slice(-maxLines).join("\n");
  } catch { return ""; }
}

export async function installHeadroomExtras(extras: HeadroomExtra[] = []) {
  const requested = extras.filter((e) => (HEADROOM_COMPRESSION_EXTRAS as readonly string[]).includes(e));
  const py = findPython310();
  if (!py) { const e = new Error("Python >= 3.10 not found"); (e as any).code = "NO_PYTHON"; throw e; }
  const installPython = ensureManagedVenv(py);
  const extrasList = ["proxy", ...requested].join(",");
  const spec = `headroom-ai[${extrasList}]`;
  const args = ["-m", "pip", "install", "--upgrade", spec];
  ensureDir();
  const outFd = fs.openSync(INSTALL_LOG_FILE, "w");
  const child = spawn(installPython, args, { stdio: ["ignore", outFd, outFd], windowsHide: true, env: HEADROOM_PROCESS_ENV });
  return new Promise((resolve, reject) => {
    child.once("error", (e) => { fs.closeSync(outFd); reject(e); });
    child.once("exit", (code) => {
      fs.closeSync(outFd);
      if (code === 0) resolve({ success: true, spec, extras: requested });
      else { const e = new Error(`pip install exited with code=${code} — see headroom/install.log`); (e as any).code = "INSTALL_FAILED"; reject(e); }
    });
  });
}

export async function uninstallHeadroomExtras(extras: HeadroomExtra[] = []) {
  const requested = extras.filter((e) => (HEADROOM_COMPRESSION_EXTRAS as readonly string[]).includes(e));
  const py = managedHeadroomPython();
  if (!py) { const e = new Error("Headroom managed environment is not installed"); (e as any).code = "NOT_INSTALLED"; throw e; }
  const pkgs = [...new Set(requested.flatMap((e) => EXTRA_MARKERS[e] || []))];
  if (!pkgs.length) { const e = new Error("No valid extras to remove"); (e as any).code = "INVALID_EXTRAS"; throw e; }
  const args = ["-m", "pip", "uninstall", "-y", ...pkgs];
  ensureDir();
  const outFd = fs.openSync(INSTALL_LOG_FILE, "w");
  const child = spawn(py, args, { stdio: ["ignore", outFd, outFd], windowsHide: true, env: HEADROOM_PROCESS_ENV });
  return new Promise((resolve, reject) => {
    child.once("error", (e) => { fs.closeSync(outFd); reject(e); });
    child.once("exit", (code) => {
      fs.closeSync(outFd);
      if (code === 0) resolve({ success: true, removed: pkgs, extras: requested });
      else { const e = new Error(`pip uninstall exited with code=${code}`); (e as any).code = "UNINSTALL_FAILED"; reject(e); }
    });
  });
}

export function getInstallLogTail(maxLines = 15) {
  try {
    if (!fs.existsSync(INSTALL_LOG_FILE)) return "";
    return fs.readFileSync(INSTALL_LOG_FILE, "utf8").split(/\r?\n/).filter(Boolean).slice(-maxLines).join("\n");
  } catch { return ""; }
}
