/**
 * Export Cursor IDE access token + machine id from local state.vscdb.
 * Run on the PC where Cursor is installed (not on VPS).
 *
 * Usage:
 *   npm run cursor:export
 *   npm run cursor:export -- --json
 */
import { findReadableCursorDbPath, readCursorTokensFromDb } from "../src/core/cursorTokenImport.ts";

const jsonMode = process.argv.includes("--json");

const { dbPath, candidates } = await findReadableCursorDbPath();
if (!dbPath) {
  console.error("Cursor database not found. Open Cursor IDE while logged in, then retry.");
  console.error("Checked:");
  for (const path of candidates) console.error(`  - ${path}`);
  process.exit(1);
}

const { tokens, errors } = await readCursorTokensFromDb(dbPath);
if (!tokens.accessToken || !tokens.machineId) {
  console.error(`Could not read token from ${dbPath}`);
  if (errors.length) console.error(errors[errors.length - 1]);
  console.error("Login to Cursor IDE on this machine, restart Cursor, then retry.");
  process.exit(1);
}

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        dbPath,
        accessToken: tokens.accessToken,
        machineId: tokens.machineId,
        accessTokenLength: tokens.accessToken.length,
        machineIdLength: tokens.machineId.length
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log("NesaRouter — Cursor token export (local PC only)");
console.log(`Source: ${dbPath}`);
console.log("");
console.log("Paste into VPS dashboard → Providers → oauth-cursor → Paste manually");
console.log("Do not share these values in chat, tickets, or git.");
console.log("");
console.log("--- access_token (copy below) ---");
console.log(tokens.accessToken);
console.log("--- machine_id (copy below) ---");
console.log(tokens.machineId);
console.log("--- end ---");
console.log("");
console.log("Token TTL is ~24h. Re-run this script when Test fails on VPS.");
