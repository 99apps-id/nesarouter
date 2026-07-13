/**
 * Optional in-process pxpipe-style transform.
 * If the `pxpipe` package is installed, use it; otherwise apply a lightweight
 * whitespace/comment collapse on long tool messages (fail-open).
 */
export interface PxpipeResult {
  body: any;
  applied: boolean;
  savedChars: number;
}

function collapseWhitespace(text: string) {
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function compressToolMessageContent(content: unknown): { content: unknown; saved: number } {
  if (typeof content === "string") {
    if (content.length < 400) return { content, saved: 0 };
    const next = collapseWhitespace(content);
    return { content: next, saved: Math.max(0, content.length - next.length) };
  }
  if (Array.isArray(content)) {
    let saved = 0;
    const next = content.map((part) => {
      if (part && typeof part === "object" && typeof (part as any).text === "string") {
        const result = compressToolMessageContent((part as any).text);
        saved += result.saved;
        return { ...part, text: result.content };
      }
      return part;
    });
    return { content: next, saved };
  }
  return { content, saved: 0 };
}

export async function compressWithPxpipe(body: any, enabled?: boolean): Promise<PxpipeResult> {
  if (!enabled || !body || typeof body !== "object") return { body, applied: false, savedChars: 0 };

  try {
    // Optional dependency — absent in most installs.
    const mod = (await import(/* webpackIgnore: true */ "pxpipe" as string).catch(() => null)) as any;
    if (mod?.transform || mod?.default?.transform) {
      const transform = mod.transform || mod.default.transform;
      const next = await transform(structuredClone(body));
      return { body: next ?? body, applied: true, savedChars: 0 };
    }
  } catch {}

  if (!Array.isArray(body.messages)) return { body, applied: false, savedChars: 0 };
  let savedChars = 0;
  const messages = body.messages.map((message: any) => {
    if (message?.role !== "tool" && message?.role !== "function") return message;
    const result = compressToolMessageContent(message.content);
    savedChars += result.saved;
    return { ...message, content: result.content };
  });
  return {
    body: savedChars ? { ...body, messages } : body,
    applied: savedChars > 0,
    savedChars
  };
}
