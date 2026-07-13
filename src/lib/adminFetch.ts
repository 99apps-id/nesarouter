/**
 * Shared fetch defaults for dashboard admin APIs (always send session cookie).
 */
export function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: init?.headers
  });
}
