import { NextResponse } from "next/server";
import { handleMediaPassthrough } from "@/core/mediaPassthrough";
import {
  authorizeClientRequest,
  readBodyBytesLimited,
  RequestBodyTooLargeError
} from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OpenAI caps audio uploads at 25 MB; allow 64 MB for long recordings. */
const MAX_TRANSCRIPTION_BYTES = 64 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await authorizeClientRequest(request))) return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: { message: "Audio transcriptions require multipart/form-data." } }, { status: 400 });
  }

  // Count real bytes: a chunked upload has no Content-Length, so size alone
  // cannot bound it. Only after the cap is enforced do we materialise the form,
  // which also avoids buffering `Content-Length + 1` bytes into memory.
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await readBodyBytesLimited(request, MAX_TRANSCRIPTION_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: { message: "Request body exceeds 64 MB." } }, { status: 413 });
    }
    return NextResponse.json({ error: { message: "Failed to read the multipart upload." } }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: bytes
    }).formData();
  } catch {
    return NextResponse.json({ error: { message: "Failed to parse multipart upload." } }, { status: 400 });
  }

  return handleMediaPassthrough(request, "transcriptions", {
    body: form,
    isFormData: true,
    probeText: "stt"
  });
}
