import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import {
  cursorAccessTokenExpiresAt,
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
 * Query: createNew=1 | accountId=<id> — same targeting as manual Connect/Import.
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

  const url = new URL(request.url);
  const createNew = url.searchParams.get("createNew") === "1" || url.searchParams.get("createNew") === "true";
  const accountId = url.searchParams.get("accountId")?.trim() || undefined;

  try {
    const { dbPath } = await findReadableCursorDbPath();
    if (!dbPath) {
      return finalizeAdminResponse(
        NextResponse.json({
          found: false,
          imported: false,
          error: "Cursor credentials were not found in the standard local profile."
        }),
        request
      );
    }

    const { tokens, errors } = await readCursorTokensFromDb(dbPath);
    if (tokens.accessToken && tokens.machineId) {
      // Prefer JWT exp; only omit expiry when unknown (do not invent a fake 24h TTL).
      const expiresAt = cursorAccessTokenExpiresAt(tokens.accessToken);
      await saveProviderOAuthTokens(
        provider.id,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || undefined,
          expiresAt,
          machineId: tokens.machineId
        },
        createNew ? { createNew: true } : { createNew: false, accountId }
      );
      return finalizeAdminResponse(
        NextResponse.json({
          found: true,
          imported: true,
          expiresAt: expiresAt ?? null,
          hasRefreshToken: Boolean(tokens.refreshToken),
          source: "local Cursor profile",
          createNew,
          accountId: accountId ?? null
        }),
        request
      );
    }

    const detail = cursorAutoImportPartialMessage("local Cursor profile", Boolean(tokens.accessToken), Boolean(tokens.machineId));
    const sqliteHint = errors.length ? " (the local credential database could not be read completely)" : "";
    return finalizeAdminResponse(
      NextResponse.json({
        found: true,
        imported: false,
        source: "local Cursor profile",
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
