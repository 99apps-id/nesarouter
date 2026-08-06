import { NextResponse } from "next/server";
import { handleMediaPassthrough } from "@/core/mediaPassthrough";
import { authorizeClientRequest, readJsonBodyLimited, RequestBodyTooLargeError } from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await authorizeClientRequest(request))) return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  let body: any;
  try {
    body = await readJsonBodyLimited(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: { message: error.message } }, { status: 413 });
    return NextResponse.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }
  return handleMediaPassthrough(request, "images", { body, probeText: "image" });
}
