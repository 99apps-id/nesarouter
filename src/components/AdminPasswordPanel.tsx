"use client";

import { KeyRound, Save } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";

export default function AdminPasswordPanel() {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  async function savePassword() {
    setMessage("");
    setStatus("idle");
    const response = await fetch("/api/auth/password", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setStatus("ok");
      setMessage(t.password.updated);
      window.setTimeout(() => {
        window.location.assign("/routing");
      }, 400);
      return;
    }
    setStatus("error");
    setMessage(typeof result.error === "string" ? result.error : t.password.failed);
  }

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">{t.password.admin}</p>
          <h2>{t.password.title}</h2>
        </div>
        <KeyRound size={18} />
      </div>
      <div className="settings-grid">
        <label>
          {t.password.current}
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </label>
        <label>
          {t.password.next}
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
      </div>
      <button className="button primary" type="button" onClick={savePassword}>
        <Save size={16} /> {t.password.save}
      </button>
      {message ? <p className={`test-message ${status}`}>{message}</p> : null}
    </section>
  );
}
