import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import { registerKiroOidcClient, startDeviceFlow, startKiroDeviceFlow } from "@/core/oauthPkce";
import { getPreset } from "@/core/oauthProviderPresets";
import { deleteDevicePending, readProviderById, saveDevicePending } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/providers/[id]/oauth/device/start — begin a device-code flow
 * (GitHub Copilot or Kiro AWS Builder ID). Returns user_code + verification_uri;
 * the device_code (and Kiro client credentials) are stored server-side.
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

  try {
    if (preset.kiroDeviceFlow) {
      const registered = await registerKiroOidcClient(preset);
      const info = await startKiroDeviceFlow(preset, registered.clientId, registered.clientSecret);
      await saveDevicePending(id, {
        deviceCode: info.device_code,
        createdAt: new Date().toISOString(),
        clientId: info.clientId,
        clientSecret: info.clientSecret,
        region: info.region
      });
      return finalizeAdminResponse(
        NextResponse.json({
          user_code: info.user_code,
          verification_uri: info.verification_uri,
          expires_in: info.expires_in,
          interval: info.interval
        }),
        request
      );
    }

    const info = await startDeviceFlow(preset);
    await saveDevicePending(id, { deviceCode: info.device_code, createdAt: new Date().toISOString() });
    return finalizeAdminResponse(
      NextResponse.json({
        user_code: info.user_code,
        verification_uri: info.verification_uri,
        expires_in: info.expires_in,
        interval: info.interval
      }),
      request
    );
  } catch (error) {
    return finalizeAdminResponse(
      NextResponse.json({ error: error instanceof Error ? error.message : "Device flow start failed." }, { status: 502 }),
      request
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  await deleteDevicePending(id);
  return finalizeAdminResponse(NextResponse.json({ ok: true }), request);
}
