/** Fixed locale so SSR (Node) and browser hydration always match. */
const DISPLAY_LOCALE = "en-US";

export function money(value: number) {
  return `$${value.toFixed(value >= 1 ? 2 : 5)}`;
}

export function formatNumber(value: number) {
  return value.toLocaleString(DISPLAY_LOCALE);
}

export function formatTime(value: Date | string | number) {
  return new Date(value).toLocaleTimeString(DISPLAY_LOCALE);
}
