import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { authorizeRequest } from "@/core/auth";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quick connectivity test from the CLI wizard (uses a freshly minted client key). */
export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as { token?: string; model?: string };
  const token = body.token?.trim();
  const model = body.model?.trim() || "auto";
  if (!token) return NextResponse.json({ error: "Client key diperlukan." }, { status: 400 });

  const store = await readStore();
  if (!authorizeRequest(store, new Request(request.url, { headers: { authorization: `Bearer ${token}` } }))) {
    return NextResponse.json({ error: "Invalid client key." }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  try {
    const response = await fetch(`${origin}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }]
      }),
      signal: AbortSignal.timeout(20_000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, status: response.status, error: payload?.error?.message ?? "Upstream gagal." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      provider: response.headers.get("x-nesa-provider") ?? undefined,
      model: payload?.model ?? model
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Test koneksi gagal." },
      { status: 502 }
    );
  }
}
