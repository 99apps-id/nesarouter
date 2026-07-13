import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { readProviderById, saveProviderOAuthTokens } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const ACCESS_TOKEN_KEYS = ["cursorAuth/accessToken", "cursorAuth/token"];
const MACHINE_ID_KEYS = ["storage.serviceMachineId", "storage.machineId", "telemetry.machineId"];

function getCandidatePaths(platform: NodeJS.Platform) {
  const home = homedir();
  if (platform === "darwin") {
    return [
      join(home, "Library/Application Support/Cursor/User/globalStorage/state.vscdb"),
      join(home, "Library/Application Support/Cursor - Insiders/User/globalStorage/state.vscdb")
    ];
  }
  if (platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    return [
      join(appData, "Cursor", "User", "globalStorage", "state.vscdb"),
      join(appData, "Cursor - Insiders", "User", "globalStorage", "state.vscdb"),
      join(localAppData, "Cursor", "User", "globalStorage", "state.vscdb")
    ];
  }
  return [
    join(home, ".config/Cursor/User/globalStorage/state.vscdb"),
    join(home, ".config/cursor/User/globalStorage/state.vscdb")
  ];
}

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
}

function extractViaBetterSqlite(dbPath: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const query = (key: string) => {
    const row = db.prepare("SELECT value FROM itemTable WHERE key=? LIMIT 1").get(key) as { value?: string } | undefined;
    return row?.value || null;
  };
  let accessToken: string | null = null;
  for (const key of ACCESS_TOKEN_KEYS) {
    const raw = query(key);
    if (raw) {
      accessToken = String(normalizeValue(raw));
      break;
    }
  }
  let machineId: string | null = null;
  for (const key of MACHINE_ID_KEYS) {
    const raw = query(key);
    if (raw) {
      machineId = String(normalizeValue(raw));
      break;
    }
  }
  db.close();
  return { accessToken, machineId };
}

async function extractViaCli(dbPath: string) {
  const query = async (sql: string) => {
    const { stdout } = await execFileAsync("sqlite3", [dbPath, sql], { timeout: 10_000 });
    return stdout.trim();
  };
  let accessToken: string | null = null;
  for (const key of ACCESS_TOKEN_KEYS) {
    try {
      const raw = await query(`SELECT value FROM itemTable WHERE key='${key}' LIMIT 1`);
      if (raw) {
        accessToken = String(normalizeValue(raw));
        break;
      }
    } catch {
      /* next */
    }
  }
  let machineId: string | null = null;
  for (const key of MACHINE_ID_KEYS) {
    try {
      const raw = await query(`SELECT value FROM itemTable WHERE key='${key}' LIMIT 1`);
      if (raw) {
        machineId = String(normalizeValue(raw));
        break;
      }
    } catch {
      /* next */
    }
  }
  return { accessToken, machineId };
}

/**
 * GET /api/providers/[id]/oauth/cursor/auto-import
 * Read Cursor IDE tokens from local state.vscdb (same machine as NesaRouter).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  if (provider.oauthProfile !== "cursor") {
    return NextResponse.json({ error: "Provider does not support Cursor auto-import." }, { status: 400 });
  }

  const saveTokens = async (accessToken: string, machineId: string) => {
    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();
    await saveProviderOAuthTokens(provider.id, { accessToken, expiresAt, machineId });
    return NextResponse.json({ found: true, imported: true, expiresAt });
  };

  try {
    const candidates = getCandidatePaths(process.platform);
    let dbPath: string | null = null;
    for (const candidate of candidates) {
      try {
        await access(candidate, constants.R_OK);
        dbPath = candidate;
        break;
      } catch {
        /* next */
      }
    }
    if (!dbPath) {
      return NextResponse.json({
        found: false,
        error:
          "Cursor database not found on this machine. Open Cursor once while logged in, or paste tokens manually."
      });
    }

    try {
      const tokens = extractViaBetterSqlite(dbPath);
      if (tokens.accessToken && tokens.machineId) {
        return saveTokens(tokens.accessToken, tokens.machineId);
      }
    } catch {
      /* try CLI */
    }

    try {
      const tokens = await extractViaCli(dbPath);
      if (tokens.accessToken && tokens.machineId) {
        return saveTokens(tokens.accessToken, tokens.machineId);
      }
    } catch {
      /* manual */
    }

    return NextResponse.json({
      found: false,
      error: "Found Cursor DB but could not read accessToken + machineId. Paste them manually."
    });
  } catch (error) {
    return NextResponse.json(
      { found: false, error: error instanceof Error ? error.message : "Auto-import failed." },
      { status: 500 }
    );
  }
}
