import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import { generatePkce, registerKiroOidcClient, startDeviceFlow, startKiroDeviceFlow } from "@/core/oauthPkce";
import { getPreset, usesOAuthDeviceFlow } from "@/core/oauthProviderPresets";
import { deleteDevicePending, readProviderById, saveDevicePending } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/providers/[id]/oauth/device/start — begin a device-code flow
 * (GitHub Copilot, Kiro, Qwen, Grok CLI, CodeBuddy, Kilo, …).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { accountId?: string; createNew?: boolean };
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  const preset = getPreset(provider.oauthProfile);
  if (!usesOAuthDeviceFlow(preset)) {
    return NextResponse.json({ error: "Provider does not use device flow." }, { status: 400 });
  }

  try {
    // A new account has no account id yet. Give each pending flow its own key
    // so concurrent Connect operations cannot overwrite one another.
    const pendingId = body.createNew ? `new-${crypto.randomUUID()}` : body.accountId;
    if (preset!.kiroDeviceFlow) {
      const registered = await registerKiroOidcClient(preset!);
      const info = await startKiroDeviceFlow(preset!, registered.clientId, registered.clientSecret);
      const createdAt = new Date().toISOString();
      const expiresInSec = Number(info.expires_in) > 0 ? Number(info.expires_in) : 15 * 60;
      await saveDevicePending(id, {
        deviceCode: info.device_code,
        createdAt,
        expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
        accountId: body.createNew ? undefined : body.accountId,
        clientId: info.clientId,
        clientSecret: info.clientSecret,
        region: info.region
      }, pendingId);
      return finalizeAdminResponse(
        NextResponse.json({
          user_code: info.user_code,
          verification_uri: info.verification_uri,
          expires_in: info.expires_in,
          interval: info.interval,
          pending_id: pendingId
        }),
        request
      );
    }

    const pkce = preset!.devicePkce ? generatePkce() : undefined;
    const info = await startDeviceFlow(preset!, pkce?.challenge);
    const createdAt = new Date().toISOString();
    const expiresInSec = Number(info.expires_in) > 0 ? Number(info.expires_in) : 15 * 60;
    await saveDevicePending(id, {
      deviceCode: info.device_code,
      createdAt,
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
      accountId: body.createNew ? undefined : body.accountId,
      codeVerifier: pkce?.verifier
    }, pendingId);
    return finalizeAdminResponse(
      NextResponse.json({
        user_code: info.user_code,
        verification_uri: info.verification_uri,
        expires_in: info.expires_in,
        interval: info.interval,
        openUrl: !info.user_code ? info.verification_uri : undefined,
        pending_id: pendingId
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
