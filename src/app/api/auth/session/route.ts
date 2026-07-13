import { NextResponse } from "next/server";
import {
  adminAuthEnabled,
  adminPasswordMustChange,
  resolveVerifiedAdminSessionToken
} from "@/core/adminAuth";
import { finalizeAdminResponse } from "@/lib/adminApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authenticated = Boolean(await resolveVerifiedAdminSessionToken(request));
  const response = NextResponse.json({
    authEnabled: await adminAuthEnabled(),
    authenticated,
    mustChangePassword: await adminPasswordMustChange()
  });
  if (authenticated) return finalizeAdminResponse(response, request);
  return response;
}
