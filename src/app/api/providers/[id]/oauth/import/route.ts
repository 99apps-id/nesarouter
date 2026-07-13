import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { readProviderById, saveProviderOAuthTokens } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/providers/[id]/oauth/import — paste an existing OAuth token pair
 * (or Cursor access token + machine id) instead of browser authorize.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  if (!provider.oauthProfile) {
    return NextResponse.json({ error: "Provider has no OAuth profile." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    machineId?: string;
    accountId?: string;
    createNew?: boolean;
  };
  const accessToken = (body.accessToken ?? "").trim();
  if (!accessToken) return NextResponse.json({ error: "access_token is required." }, { status: 400 });
  const refreshToken = (body.refreshToken ?? "").trim() || undefined;
  const machineId = (body.machineId ?? "").trim() || undefined;
  if (provider.oauthProfile === "cursor" && accessToken.length < 50) {
    return NextResponse.json({ error: "Cursor token looks too short." }, { status: 400 });
  }
  const expiresAt = body.expiresIn
    ? new Date(Date.now() + body.expiresIn * 1000).toISOString()
    : provider.oauthProfile === "cursor"
      ? new Date(Date.now() + 86400 * 1000).toISOString()
      : undefined;

  await saveProviderOAuthTokens(provider.id, { accessToken, refreshToken, expiresAt, machineId }, {
    accountId: body.accountId,
    createNew: Boolean(body.createNew)
  });
  return NextResponse.json({ ok: true, expiresAt, machineId: Boolean(machineId) });
}
