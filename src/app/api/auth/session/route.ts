import { NextResponse } from "next/server";
import { adminAuthEnabled, adminPasswordMustChange, adminTokenFromRequest, verifyAdminToken } from "@/core/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json({
    authEnabled: await adminAuthEnabled(),
    authenticated: await verifyAdminToken(adminTokenFromRequest(request)),
    mustChangePassword: await adminPasswordMustChange()
  });
}
