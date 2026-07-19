import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { authorizeRequest } from "@/core/auth";
import { keyId } from "@/lib/keyIdentity";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveToken(store: Awaited<ReturnType<typeof readStore>>, body: { token?: string; keyId?: string }) {
  const direct = body.token?.trim();
  if (direct) return direct;
  const id = body.keyId?.trim();
  if (!id) return "";
  return store.localApiKeys.find((token) => keyId(token) === id) ?? "";
}

/** Quick connectivity test from the CLI wizard (client key + optional chat probe). */
export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    keyId?: string;
    model?: string;
    chat?: boolean;
    toolProbe?: boolean;
  };
  const store = await readStore();
  const token = resolveToken(store, body);
  const model = body.model?.trim() || "auto";
  if (!token) {
    return NextResponse.json(
      { error: "Provide a client key (token) or keyId from Keys." },
      { status: 400 }
    );
  }

  if (!authorizeRequest(store, new Request(request.url, { headers: { authorization: `Bearer ${token}` } }))) {
    return NextResponse.json({ error: "Invalid client key." }, { status: 401 });
  }

  // This is a server-side routing probe, so never hairpin through the public
  // tunnel/reverse proxy. Public DNS may not resolve back into the same VPS.
  const port = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 20129;
  const origin = process.env.NESA_INTERNAL_URL?.trim().replace(/\/$/, "") || `http://127.0.0.1:${port}`;
  try {
    const modelsResponse = await fetch(`${origin}/v1/models`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000)
    });
    if (!modelsResponse.ok) {
      const payload = await modelsResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          ok: false,
          step: "models",
          status: modelsResponse.status,
          error: payload?.error?.message ?? `GET /v1/models failed (${modelsResponse.status}).`
        },
        { status: 502 }
      );
    }

    const doChat = body.chat !== false;
    if (!doChat) {
      return NextResponse.json({
        ok: true,
        step: "models",
        message: "Client key accepted by NesaRouter (/v1/models)."
      });
    }

    const response = await fetch(`${origin}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: body.toolProbe ? 64 : 8,
        messages: [{ role: "user", content: body.toolProbe ? "Call nesa_connectivity_probe with value ok." : "ping" }],
        ...(body.toolProbe ? {
          tools: [{
            type: "function",
            function: {
              name: "nesa_connectivity_probe",
              description: "Verify function calling without executing a system command.",
              parameters: {
                type: "object",
                properties: { value: { type: "string" } },
                required: ["value"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "nesa_connectivity_probe" } }
        } : {})
      }),
      signal: AbortSignal.timeout(20_000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const attempts = Array.isArray(payload?.error?.attempts) ? payload.error.attempts : undefined;
      return NextResponse.json(
        {
          ok: false,
          step: "chat",
          status: response.status,
          error: payload?.error?.message ?? "Chat probe failed.",
          attempts,
          skipped: response.headers.get("x-nesa-skipped") ?? undefined
        },
        { status: 502 }
      );
    }
    if (body.toolProbe) {
      const toolCalls = payload?.choices?.[0]?.message?.tool_calls;
      if (!Array.isArray(toolCalls) || toolCalls[0]?.function?.name !== "nesa_connectivity_probe") {
        return NextResponse.json(
          {
            ok: false,
            step: "tools",
            status: 502,
            error: "Provider menjawab chat tetapi tidak mengembalikan function call. Pilih model/provider yang mendukung tools.",
            provider: response.headers.get("x-nesa-provider") ?? undefined
          },
          { status: 502 }
        );
      }
    }
    return NextResponse.json({
      ok: true,
      step: "chat",
      provider: response.headers.get("x-nesa-provider") ?? undefined,
      model: payload?.model ?? model,
      skipped: response.headers.get("x-nesa-skipped") ?? undefined,
      message: body.toolProbe
        ? `NesaRouter tool calling OK -> ${response.headers.get("x-nesa-provider") ?? "provider"}`
        : `NesaRouter routed ping -> ${response.headers.get("x-nesa-provider") ?? "provider"}`
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Test koneksi gagal." },
      { status: 502 }
    );
  }
}
