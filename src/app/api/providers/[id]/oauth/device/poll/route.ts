import { NextResponse } from "next/server";
import { finalizeAdminResponse, readAdminJson, requireAdmin } from "@/lib/adminApi";
import { pollDeviceFlow, pollKiroDeviceFlow } from "@/core/oauthPkce";
import { mintMuseKey } from "@/core/museAuth";
import { getPreset, usesOAuthDeviceFlow } from "@/core/oauthProviderPresets";
import { readProviderById } from "@/lib/store";
import { saveProviderOAuthTokens } from "@/lib/providerOAuthPersistence";
import { deleteDevicePending, readDevicePending } from "@/lib/oauthPendingPersistence";

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
  const parsedBody = await readAdminJson<{ accountId?: string; pendingId?: string }>(request, 16 * 1024);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.data;
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  const preset = getPreset(provider.oauthProfile);
  if (!usesOAuthDeviceFlow(preset)) {
    return NextResponse.json({ error: "Provider does not use device flow." }, { status: 400 });
  }

  const accountId = body.accountId?.trim() || undefined;
  const pendingId = body.pendingId?.trim() || accountId;
  const pending = await readDevicePending(id, pendingId);
  if (!pending) return NextResponse.json({ error: "No device flow in progress. Call /device/start first." }, { status: 400 });
  const expired = pending.expiresAt
    ? Date.now() > new Date(pending.expiresAt).getTime()
    : Date.now() - new Date(pending.createdAt).getTime() > 15 * 60_000;
  if (expired) {
    await deleteDevicePending(id, pendingId);
    return NextResponse.json({ error: "Device flow expired. Restart." }, { status: 410 });
  }

  try {
    const tokens = preset!.kiroDeviceFlow
      ? await pollKiroDeviceFlow(
          pending.region ?? preset!.kiroRegion ?? "us-east-1",
          pending.clientId ?? "",
          pending.clientSecret ?? "",
          pending.deviceCode
        )
      : await pollDeviceFlow(preset!, pending.deviceCode, pending.codeVerifier);

    const deviceAccess = tokens.access_token;
    if (!deviceAccess) throw new Error("Device flow returned no access token.");
    const refreshToken = tokens.refresh_token;
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined;

    // Muse's device grant yields a "dca:" token the model endpoint rejects, so it
    // is immediately exchanged for a durable API key: the key becomes the access
    // token and the dca token is kept as the refresh, which lets a revoked key be
    // re-minted later without sending the operator through another login.
    let accessToken = deviceAccess;
    let museAccountId: string | undefined;
    if (preset!.museMintUrl) {
      const minted = await mintMuseKey(deviceAccess, { mintUrl: preset!.museMintUrl });
      accessToken = minted.apiKey;
      museAccountId = minted.accountId || undefined;
    }

    await saveProviderOAuthTokens(provider.id, {
      accessToken,
      refreshToken: preset!.museMintUrl ? deviceAccess : refreshToken,
      // A minted Muse key is stable for the account, so it must not be marked
      // expired; an expiry here would make the dashboard renew it pointlessly.
      expiresAt: preset!.museMintUrl ? undefined : expiresAt,
      ...(preset!.kiroDeviceFlow && pending.clientId && pending.clientSecret
        ? { deviceClientId: pending.clientId, deviceClientSecret: pending.clientSecret }
        : {})
    }, {
      accountId: pending.accountId,
      createNew: !pending.accountId
    });
    await deleteDevicePending(id, pendingId);
    return finalizeAdminResponse(
      // The minted key's user_email is the only field that says which Meta
      // account was linked, so it is surfaced for the dashboard.
      NextResponse.json(museAccountId ? { status: "ok", account: museAccountId } : { status: "ok" }),
      request
    );
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
