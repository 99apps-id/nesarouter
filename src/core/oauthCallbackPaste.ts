/**
 * Parse pasted OAuth callback values (9router-style full URL, Claude code#state, or bare code).
 */
export function parseOAuthCallbackPaste(raw: string, fallbackState?: string) {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return { code: "", state: fallbackState };

  // Full callback URL from the browser address bar (9router / Codex / Kimchi style).
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("://") || /[?&#](code|token)=/i.test(trimmed)) {
    try {
      const href = trimmed.includes("://") ? trimmed : `http://localhost${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
      const url = new URL(href);
      const code = (url.searchParams.get("code") || url.searchParams.get("token"))?.trim() || "";
      const state = url.searchParams.get("state")?.trim() || fallbackState;
      if (code) return { code, state };
    } catch {
      /* fall through */
    }
    const codeMatch = trimmed.match(/[?&#](?:code|token)=([^&#\s]+)/i);
    const stateMatch = trimmed.match(/[?&#]state=([^&#\s]+)/i);
    if (codeMatch?.[1]) {
      return {
        code: decodeURIComponent(codeMatch[1]),
        state: stateMatch?.[1] ? decodeURIComponent(stateMatch[1]) : fallbackState
      };
    }
  }

  const hashIdx = trimmed.indexOf("#");
  if (hashIdx > 0 && !trimmed.includes("?")) {
    return {
      code: trimmed.slice(0, hashIdx).trim(),
      state: trimmed.slice(hashIdx + 1).trim() || fallbackState
    };
  }

  return { code: trimmed, state: fallbackState };
}
