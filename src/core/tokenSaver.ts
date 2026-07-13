export type SaverLevel = "off" | "lite" | "full" | "ultra";

export interface TokenSaverSettings {
  caveman: SaverLevel;
  ponytail: SaverLevel;
}

export const defaultTokenSaver: TokenSaverSettings = {
  caveman: "lite",
  ponytail: "off"
};

const cavemanPrompts: Record<Exclude<SaverLevel, "off">, string> = {
  lite: "Reply concisely. Drop filler and pleasantries; keep technical substance.",
  full: "Reply in terse caveman style: short fragments, no filler, no hedging, no apologies. Preserve all technical correctness and code. Why use many token when few token do trick.",
  ultra: "Ultra-terse caveman: raw output only, no prose, no explanations unless explicitly requested. Code/data first. Strip every non-essential word."
};

const ponytailPrompts: Record<Exclude<SaverLevel, "off">, string> = {
  lite: "Act as a lazy senior dev. Build exactly what is asked. Name the lazier alternative only when it is clearly better.",
  full: "Act as a lazy senior dev enforcing YAGNI. Prefer stdlib, then native, then existing deps, then a one-liner, then minimal code. Avoid new abstractions, unrequested helpers, and speculative scaffolding.",
  ultra: "Act as a YAGNI extremist. Delete before adding. Ship the shortest working one-liner. Challenge any part of the requirement that invites unneeded code, in the same response."
};

function systemText(settings: TokenSaverSettings) {
  const parts: string[] = [];
  if (settings.caveman !== "off") parts.push(cavemanPrompts[settings.caveman]);
  if (settings.ponytail !== "off") parts.push(ponytailPrompts[settings.ponytail]);
  return parts.join("\n\n");
}

/**
 * Inject Caveman/Ponytail system guidance into an OpenAI chat request body.
 * Preserves an existing system message by appending to it; otherwise prepends
 * a new system message. Returns a new body object (shallow clone) so the caller
 * keeps the original.
 */
export function injectTokenSaver(body: any, settings: TokenSaverSettings | undefined) {
  if (!settings) return body;
  const guidance = systemText(settings);
  if (!guidance) return body;

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) {
    return { ...body, messages: [{ role: "system", content: guidance }, { role: "user", content: "" }] };
  }

  const first = messages[0];
  if (first?.role === "system") {
    const existingText = typeof first.content === "string"
      ? first.content
      : Array.isArray(first.content)
        ? first.content.map((part: any) => part?.text ?? "").join("\n")
        : "";
    const merged: any = { ...first, content: `${existingText}\n\n${guidance}`.trim() };
    return { ...body, messages: [merged, ...messages.slice(1)] };
  }

  return { ...body, messages: [{ role: "system", content: guidance }, ...messages] };
}
