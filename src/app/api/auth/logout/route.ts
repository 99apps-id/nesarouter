import { NextResponse } from "next/server";
import { adminCookieName, readAdminSessionTokenCandidates, revokeAdminToken } from "@/core/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  for (const token of await readAdminSessionTokenCandidates(request)) {
    await revokeAdminToken(token);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
