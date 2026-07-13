import { findReadableCursorDbPath, readCursorTokensFromDb } from "../src/core/cursorTokenImport.ts";

const { dbPath } = await findReadableCursorDbPath();
console.log("dbPath:", dbPath);
if (!dbPath) process.exit(1);

const { tokens, errors } = await readCursorTokensFromDb(dbPath);
console.log("accessToken:", Boolean(tokens.accessToken), tokens.accessToken?.length ?? 0);
console.log("machineId:", Boolean(tokens.machineId), tokens.machineId?.length ?? 0);
if (errors.length) console.log("errors:", errors);
process.exit(tokens.accessToken && tokens.machineId ? 0 : 1);
