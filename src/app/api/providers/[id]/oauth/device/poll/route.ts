import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import { pollDeviceFlow, pollKiroDeviceFlow } from "@/core/oauthPkce";
import { getPreset } from "@/core/oauthProviderPresets";
import { deleteDevicePending, readDevicePending, readProviderById, saveProviderOAuthTokens } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/providers/[id]/oauth/device/poll — poll the device-code flow once.
 * Returns { status: "pending" } until the user authorizes, then { status: "ok" }.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  const preset = getPreset(provider.oauthProfile);
  if (!preset?.deviceFlow && !preset?.kiroDeviceFlow) {
    return NextResponse.json({ error: "Provider does not use device flow." }, { status: 400 });
  }

  const pending = await readDevicePending(id);
  if (!pending) return NextResponse.json({ error: "No device flow in progress. Call /device/start first." }, { status: 400 });
  const ageMs = Date.now() - new Date(pending.createdAt).getTime();
  if (ageMs > 15 * 60_000) {
    await deleteDevicePending(id);
    return NextResponse.json({ error: "Device flow expired. Restart." }, { status: 410 });
  }

  try {
    const tokens = preset.kiroDeviceFlow
      ? await pollKiroDeviceFlow(
          pending.region ?? preset.kiroRegion ?? "us-east-1",
          pending.clientId ?? "",
          pending.clientSecret ?? "",
          pending.deviceCode
        )
      : await pollDeviceFlow(preset, pending.deviceCode);

    const accessToken = tokens.access_token;
    if (!accessToken) throw new Error("Device flow returned no access token.");
    const refreshToken = tokens.refresh_token;
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined;
    await saveProviderOAuthTokens(provider.id, {
      accessToken,
      refreshToken,
      expiresAt,
      ...(preset.kiroDeviceFlow && pending.clientId && pending.clientSecret
        ? { deviceClientId: pending.clientId, deviceClientSecret: pending.clientSecret }
        : {})
    }, {
      accountId: pending.accountId,
      createNew: !pending.accountId
    });
    await deleteDevicePending(id, pending.accountId);
    return finalizeAdminResponse(NextResponse.json({ status: "ok" }), request);
  } catch (error) {
    const err = error as Error & { pending?: boolean; interval?: number };
    if (err.pending) {
      return finalizeAdminResponse(
        NextResponse.json({ status: "pending", interval: err.interval ?? 5 }),
        request
      );
    }
    return finalizeAdminResponse(
      NextResponse.json({ error: err.message ?? "Device poll failed." }, { status: 502 }),
      request
    );
  }
}
