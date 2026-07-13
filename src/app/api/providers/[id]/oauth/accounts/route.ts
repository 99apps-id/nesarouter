import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import { clearOAuthAccount } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { accountId?: string };
  if (!body.accountId) {
    return finalizeAdminResponse(NextResponse.json({ ok: false, error: "accountId is required." }, { status: 400 }), request);
  }
  await clearOAuthAccount(id, body.accountId);
  return finalizeAdminResponse(NextResponse.json({ ok: true }), request);
}
