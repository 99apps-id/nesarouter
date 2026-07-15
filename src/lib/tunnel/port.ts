/** Shared tunnel/Tailscale local port validation. */
export function normalizeTunnelPort(port: unknown, fallback?: number): number {
  const n = Number(port);
  if (Number.isInteger(n) && n >= 1 && n <= 65535) return n;
  if (fallback != null && Number.isInteger(fallback) && fallback >= 1 && fallback <= 65535) return fallback;
  throw new Error("Port must be an integer between 1 and 65535.");
}
