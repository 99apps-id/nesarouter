import { NextResponse } from "next/server";
import {
  adminCookieName,
  adminCookieOptions,
  adminPasswordMustChange,
  createAdminSession,
  loginRateLimitKey,
  MAX_LOGIN_ATTEMPTS,
  readLoginLock,
  recordLoginFailure,
  recordLoginSuccess,
  verifyAdminPassword
} from "@/core/adminAuth";
import { readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const lockKey = loginRateLimitKey(request);
  const lock = await readLoginLock(lockKey);
  if (lock.locked) {
    return NextResponse.json(
      {
        ok: false,
        error: "Login locked. Try again later.",
        lockedUntil: lock.lockedUntil,
        remainingMs: lock.remainingMs,
        maxAttempts: MAX_LOGIN_ATTEMPTS
      },
      { status: 423 }
    );
  }

  let body: { password?: string };
  try {
    body = await readJsonBodyLimited<{ password?: string }>(request, 16 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 413 });
    }
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!(await verifyAdminPassword(body.password ?? ""))) {
    const nextLock = await recordLoginFailure(lockKey);
    return NextResponse.json(
      {
        ok: false,
        error: nextLock.locked ? "Login locked. Try again later." : "Invalid admin password.",
        failedAttempts: nextLock.failedAttempts,
        lockedUntil: nextLock.lockedUntil,
        remainingMs: nextLock.remainingMs,
        maxAttempts: MAX_LOGIN_ATTEMPTS
      },
      { status: nextLock.locked ? 423 : 401 }
    );
  }

  await recordLoginSuccess(lockKey);
  const response = NextResponse.json({ ok: true, mustChangePassword: await adminPasswordMustChange() });
  response.cookies.set(adminCookieName, await createAdminSession(), adminCookieOptions(request));
  return response;
}
