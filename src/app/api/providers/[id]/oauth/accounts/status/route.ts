import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import { oauthAccountStatusesFromProvider, probeAllOAuthAccounts } from "@/core/oauthAccountProbe";
import { routableOAuthAccountCount } from "@/core/oauthAccounts";
import { readProviderById } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — current stored OAuth account statuses (cheap, for UI polling). */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ ok: false, error: "Provider not found." }, { status: 404 });
  if (!provider.oauthProfile) {
    return NextResponse.json({ ok: false, error: "Not an OAuth provider." }, { status: 400 });
  }
  const accounts = oauthAccountStatusesFromProvider(provider);
  return finalizeAdminResponse(
    NextResponse.json({
      ok: true,
      accounts,
      routableCount: routableOAuthAccountCount(provider),
      updatedAt: new Date().toISOString()
    }),
    request
  );
}

/** POST — probe upstream for each account and persist green/red status. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ ok: false, error: "Provider not found." }, { status: 404 });
  if (!provider.oauthProfile) {
    return NextResponse.json({ ok: false, error: "Not an OAuth provider." }, { status: 400 });
  }
  const accounts = await probeAllOAuthAccounts(provider);
  const refreshed = await readProviderById(id);
  return finalizeAdminResponse(
    NextResponse.json({
      ok: true,
      accounts,
      routableCount: refreshed ? routableOAuthAccountCount(refreshed) : 0,
      updatedAt: new Date().toISOString()
    }),
    request
  );
}
