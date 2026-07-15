#!/usr/bin/env node
/**
 * Fail fast with a clear message when PORT is already taken (common on Windows
 * when a previous next dev / standalone process was left running).
 */
import { execSync } from "node:child_process";
import net from "node:net";

const port = Number(process.env.PORT || process.argv[2] || 20129);

function findListenerPid(portNumber) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${portNumber}`, { encoding: "utf8" });
      const lines = out
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /LISTENING/i.test(line));
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const pid = parts[parts.length - 1];
        if (/^\d+$/.test(pid) && pid !== "0") return pid;
      }
      return null;
    }
    const out = execSync(`lsof -iTCP:${portNumber} -sTCP:LISTEN -n -P -t`, { encoding: "utf8" });
    const pid = out.trim().split(/\r?\n/)[0];
    return pid || null;
  } catch {
    return null;
  }
}

function checkPort(portNumber) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      resolve({ ok: false, error });
    });
    server.once("listening", () => {
      server.close(() => resolve({ ok: true }));
    });
    server.listen(portNumber, "0.0.0.0");
  });
}

const result = await checkPort(port);
if (!result.ok) {
  const pid = findListenerPid(port);
  console.error(`Port ${port} is already in use${pid ? ` (PID ${pid})` : ""}.`);
  console.error(`Stop the other NesaRouter / Next process, then retry.`);
  if (process.platform === "win32" && pid) {
    console.error(`PowerShell: Stop-Process -Id ${pid} -Force`);
  } else if (pid) {
    console.error(`Shell: kill ${pid}`);
  }
  process.exit(1);
}

process.exit(0);
