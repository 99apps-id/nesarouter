import { NextResponse } from "next/server";
import {
  adminCookieName,
  adminCookieOptions,
  createAdminSession,
  hashAdminPassword,
  revokeAllAdminSessions,
  verifyAdminPassword
} from "@/core/adminAuth";
import { readAdminJson, requireAdmin } from "@/lib/adminApi";
import { writeAdminPasswordHash } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const unauthorized = await requireAdmin(request, { allowDuringMustChange: true });
  if (unauthorized) return unauthorized;

  const parsedBody = await readAdminJson<{
    currentPassword?: string;
    newPassword?: string;
  }>(request, 16 * 1024);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.data;

  if (!(await verifyAdminPassword(body.currentPassword ?? ""))) {
    return NextResponse.json({ error: "Current password is wrong." }, { status: 400 });
  }

  const nextPassword = body.newPassword?.trim() ?? "";
  if (nextPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  await writeAdminPasswordHash(hashAdminPassword(nextPassword));
  await revokeAllAdminSessions();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, await createAdminSession(), adminCookieOptions(request));
  return response;
}
