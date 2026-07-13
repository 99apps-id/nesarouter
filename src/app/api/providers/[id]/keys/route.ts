import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { keyPreview } from "@/lib/providerLabels";
import { clearProviderApiKeys, readProviderById, updateProvider } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { key?: string };
  const key = (body.key ?? "").trim().replace(/^Bearer\s+/i, "").trim();
  if (!key) return NextResponse.json({ error: "Key is required." }, { status: 400 });

  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });

  if (!provider.apiKey) {
    await updateProvider({ ...provider, apiKey: key, apiKeys: [] });
    return NextResponse.json({ ok: true, preview: keyPreview(key), count: 1 });
  }

  const extras = Array.isArray(provider.apiKeys) ? [...provider.apiKeys] : [];
  if (!extras.includes(key) && provider.apiKey !== key) extras.push(key);
  await updateProvider({ ...provider, apiKeys: extras });
  return NextResponse.json({ ok: true, preview: keyPreview(key), count: (provider.apiKey ? 1 : 0) + extras.length });
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
    if (!newPrimary) {
      await clearProviderApiKeys(provider.id);
      return NextResponse.json({ ok: true, count: 0 });
    }
    await updateProvider({ ...provider, apiKey: newPrimary, apiKeys: extras });
    return NextResponse.json({ ok: true, count: (newPrimary ? 1 : 0) + extras.length });
  }

  const extras = Array.isArray(provider.apiKeys) ? [...provider.apiKeys] : [];
  extras.splice(index - 1, 1);
  await updateProvider({ ...provider, apiKeys: extras });
  return NextResponse.json({ ok: true, count: (provider.apiKey ? 1 : 0) + extras.length });
}
