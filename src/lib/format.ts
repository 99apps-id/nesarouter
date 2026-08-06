/** Fixed locale so SSR (Node) and browser hydration always match. */
const DISPLAY_LOCALE = "en-US";

export function money(value: number) {
  return `$${value.toFixed(value >= 1 ? 2 : 5)}`;
}

export function formatNumber(value: number) {
  return value.toLocaleString(DISPLAY_LOCALE);
}

/** UTC clock text — avoids hydration mismatches across server/browser timezones. */
export function formatTime(value: Date | string | number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return (
    date.toLocaleTimeString(DISPLAY_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC"
    }) + " UTC"
  );
}
