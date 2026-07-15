"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { adminFetch } from "@/lib/adminFetch";

export default function SignOutButton() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await adminFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* still clear the local session view */
    }
    window.location.assign("/login");
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      aria-label={t.shell.signOut}
    >
      <LogOut size={16} />
      <span>{busy ? t.shell.signingOut : t.shell.signOut}</span>
    </button>
  );
}
