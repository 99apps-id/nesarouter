import { NextResponse } from "next/server";
import { adminCookieName, adminTokenFromRequest, revokeAdminToken } from "@/core/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await revokeAdminToken(adminTokenFromRequest(request));
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
