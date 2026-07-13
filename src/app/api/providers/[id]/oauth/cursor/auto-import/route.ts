import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import {
  cursorAutoImportNotFoundMessage,
  cursorAutoImportPartialMessage,
  findReadableCursorDbPath,
  readCursorTokensFromDb
} from "@/core/cursorTokenImport";
import { readProviderById, saveProviderOAuthTokens } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    const { dbPath, candidates } = await findReadableCursorDbPath();
    if (!dbPath) {
      return finalizeAdminResponse(
        NextResponse.json({
          found: false,
          imported: false,
          error: cursorAutoImportNotFoundMessage(process.platform, candidates)
        }),
        request
      );
    }

    const { tokens, errors } = await readCursorTokensFromDb(dbPath);
    if (tokens.accessToken && tokens.machineId) {
      const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();
      await saveProviderOAuthTokens(provider.id, {
        accessToken: tokens.accessToken,
        expiresAt,
        machineId: tokens.machineId
      }, { createNew: false });
      return finalizeAdminResponse(
        NextResponse.json({ found: true, imported: true, expiresAt, dbPath }),
        request
      );
    }

    const detail = cursorAutoImportPartialMessage(dbPath, Boolean(tokens.accessToken), Boolean(tokens.machineId));
    const sqliteHint = errors.length ? ` (${errors[errors.length - 1]})` : "";
    return finalizeAdminResponse(
      NextResponse.json({
        found: true,
        imported: false,
        dbPath,
        error: `${detail}${sqliteHint}`
      }),
      request
    );
  } catch (error) {
    return finalizeAdminResponse(
      NextResponse.json(
        { found: false, imported: false, error: error instanceof Error ? error.message : "Auto-import failed." },
        { status: 500 }
      ),
      request
    );
  }
}
