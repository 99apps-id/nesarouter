import { NextResponse } from "next/server";
import { adminPasswordMustChange, adminTokenFromRequest, verifyAdminToken } from "@/core/adminAuth";

/**
 * Admin gate for dashboard APIs. While the bootstrap password is still in use,
 * only allowDuringMustChange routes (password / session / logout) may proceed.
 */
export async function requireAdmin(
  request: Request,
  options?: { allowDuringMustChange?: boolean }
): Promise<NextResponse | null> {
  if (!(await verifyAdminToken(adminTokenFromRequest(request)))) {
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
