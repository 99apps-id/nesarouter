import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { readAdminJson, requireAdmin } from "@/lib/adminApi";
import { addLocalApiKey, deleteLocalApiKey, readStore } from "@/lib/store";
import { keyId, keyPreview } from "@/lib/keyIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const store = await readStore();
  return NextResponse.json({
    keys: store.localApiKeys.map((token) => ({ id: keyId(token), preview: keyPreview(token) }))
  });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const token = `nesa_${crypto.randomBytes(24).toString("base64url")}`;
  await addLocalApiKey(token);
  return NextResponse.json({ token, id: keyId(token), preview: keyPreview(token) });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsedBody = await readAdminJson<{ id?: string; token?: string }>(request, 16 * 1024);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.data;
  if (!body.id && !body.token) {
    return NextResponse.json({ error: "Key id or token required." }, { status: 400 });
  }
  if (body.token) {
    await deleteLocalApiKey(body.token);
    return NextResponse.json({ ok: true });
  }
  const store = await readStore();
  const match = store.localApiKeys.find((token) => keyId(token) === body.id);
  if (!match) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  await deleteLocalApiKey(match);
  return NextResponse.json({ ok: true });
}
