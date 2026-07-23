import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { alignKeyQuotas, spliceKeyQuotas } from "@/core/quota";
import { keyPreview } from "@/lib/providerLabels";
import { clearProviderApiKeys, readProviderById, updateProvider } from "@/lib/store";
import { AddKeySchema } from "@/lib/validation";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const rl = checkRateLimit(rateLimitKey(request, "add-key"), 10);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited. Try again later." }, { status: 429 });
  }

  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = AddKeySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Validation failed." }, { status: 400 });
  }

  const key = parsed.data.key.trim().replace(/^Bearer\s+/i, "").trim();
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });

  const ownQuota = Number(parsed.data.quotaLimitTokens ?? 0);

  if (!provider.apiKey) {
    const keyQuotas = ownQuota > 0 ? [{ quotaLimitTokens: ownQuota }] : alignKeyQuotas(provider.keyQuotas, 1);
    await updateProvider({ ...provider, apiKey: key, apiKeys: [], keyQuotas });
    logAdminAction("key.add", `Primary key added for provider "${provider.name}".`, { providerId: id, preview: keyPreview(key) });
    return NextResponse.json({ ok: true, preview: keyPreview(key), count: 1 });
  }

  const extras = Array.isArray(provider.apiKeys) ? [...provider.apiKeys] : [];
  if (!extras.includes(key) && provider.apiKey !== key) extras.push(key);
  const count = (provider.apiKey ? 1 : 0) + extras.length;
  const keyQuotas = alignKeyQuotas(provider.keyQuotas, count);
  if (ownQuota > 0) keyQuotas[count - 1] = { quotaLimitTokens: ownQuota };
  await updateProvider({ ...provider, apiKeys: extras, keyQuotas });
  return NextResponse.json({ ok: true, preview: keyPreview(key), count });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { index?: number; quotaLimitTokens?: number | null };
  const index = Number(body.index);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Valid key index required." }, { status: 400 });
  }

  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });

  const primary = provider.apiKey ? 1 : 0;
  const extras = Array.isArray(provider.apiKeys) ? provider.apiKeys.length : 0;
  const count = primary + extras;
  if (index >= count) return NextResponse.json({ error: "Key index out of range." }, { status: 400 });

  const keyQuotas = alignKeyQuotas(provider.keyQuotas, count);
  const quota = Number(body.quotaLimitTokens ?? 0);
  keyQuotas[index] = quota > 0 ? { quotaLimitTokens: quota } : {};
  await updateProvider({ ...provider, keyQuotas });
  return NextResponse.json({ ok: true, keyQuotas });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { index?: number };
  const index = Number(body.index);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Valid key index required." }, { status: 400 });
  }

  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });

  // Index 0 is the primary apiKey; >=1 maps to apiKeys[index-1].
  if (index === 0) {
    const extras = Array.isArray(provider.apiKeys) ? [...provider.apiKeys] : [];
    const newPrimary = extras.shift() ?? "";
    const keyQuotas = spliceKeyQuotas(provider.keyQuotas, 0);
    if (!newPrimary) {
      await clearProviderApiKeys(provider.id);
      return NextResponse.json({ ok: true, count: 0 });
    }
    await updateProvider({ ...provider, apiKey: newPrimary, apiKeys: extras, keyQuotas });
    return NextResponse.json({ ok: true, count: (newPrimary ? 1 : 0) + extras.length });
  }

  const extras = Array.isArray(provider.apiKeys) ? [...provider.apiKeys] : [];
  extras.splice(index - 1, 1);
  const keyQuotas = spliceKeyQuotas(provider.keyQuotas, index);
  await updateProvider({ ...provider, apiKeys: extras, keyQuotas });
  logAdminAction("key.remove", `Key removed from provider "${provider.name}" (index ${index}).`, { providerId: id, keyIndex: index });
  return NextResponse.json({ ok: true, count: (provider.apiKey ? 1 : 0) + extras.length });
}
