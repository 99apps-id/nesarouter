import { NextResponse } from "next/server";
import { handleMediaPassthrough } from "@/core/mediaPassthrough";
import { authorizeClientRequest, isRequestBodyTooLarge } from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await authorizeClientRequest(request))) return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  if (isRequestBodyTooLarge(request)) return NextResponse.json({ error: { message: "Request body exceeds 16 MB." } }, { status: 413 });
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }
  return handleMediaPassthrough(request, "speech", { body, probeText: "tts", binaryResponse: true });
}
