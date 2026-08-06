"use client";

import { useEffect } from "react";
import { adminFetch } from "@/lib/adminFetch";

const REFRESH_MS = 10 * 60_000;

/** Keep the sliding admin session cookie fresh while the dashboard is open. */
export default function SessionKeeper() {
  useEffect(() => {
    const refresh = () => {
      // Ignore transient network / HMR failures so the overlay never surfaces
      // "Failed to fetch" from a background keepalive ping.
      void adminFetch("/api/auth/session").catch(() => {});
    };

    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return null;
}
