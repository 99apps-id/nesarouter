import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  adminCookieName,
  adminPasswordMustChange,
  adminTokenFromRequest,
  verifyAdminToken
} from "@/core/adminAuth";

/**
 * Admin gate for dashboard APIs. While the bootstrap password is still in use,
 * only allowDuringMustChange routes (password / session / logout) may proceed.
 */
export async function requireAdmin(
  request: Request,
  options?: { allowDuringMustChange?: boolean }
): Promise<NextResponse | null> {
  // Prefer next/headers cookies() (same path AppShell uses) — more reliable than
  // regex-parsing Cookie behind some proxies than adminTokenFromRequest alone.
  let token: string | undefined;
  try {
    token = (await cookies()).get(adminCookieName)?.value;
  } catch {
    token = undefined;
  }
  if (!token) token = adminTokenFromRequest(request);

  if (!(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }
  if (!options?.allowDuringMustChange && (await adminPasswordMustChange())) {
    return NextResponse.json(
      {
        error: "Change the default admin password before continuing.",
        mustChangePassword: true
      },
      { status: 403 }
    );
  }
  return null;
}
