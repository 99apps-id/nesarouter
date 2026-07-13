export const ADMIN_SESSION_EXPIRED = "Session expired. Please log in again.";

type AdminFetchInit = RequestInit & {
  /** When true, redirect to /login after a short delay on 401. Default: false. */
  redirectOn401?: boolean;
};

/**
 * Shared fetch defaults for dashboard admin APIs (always send session cookie).
 * Does not hard-redirect on 401 by default — callers show an error first.
 */
export function adminFetch(input: RequestInfo | URL, init?: AdminFetchInit): Promise<Response> {
  const { redirectOn401 = false, ...fetchInit } = init ?? {};
  return fetch(input, {
    ...fetchInit,
    credentials: "include",
    headers: fetchInit.headers
  }).then((response) => {
    if (response.status === 401 && typeof window !== "undefined" && redirectOn401) {
      scheduleLoginRedirect();
    }
    return response;
  });
}

export function scheduleLoginRedirect(nextPath?: string) {
  if (typeof window === "undefined") return;
  const next = nextPath ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.setTimeout(() => {
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }, 700);
}

export function isAdminUnauthorized(response: Response) {
  return response.status === 401;
}
