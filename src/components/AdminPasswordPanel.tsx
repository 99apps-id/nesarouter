"use client";

import { KeyRound, Save } from "lucide-react";
import { useState } from "react";

export default function AdminPasswordPanel() {
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
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setStatus("ok");
      setMessage("Password updated.");
      return;
    }
    setStatus("error");
    setMessage(result.error ?? "Failed to update password.");
  }

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">Admin</p>
          <h2>Password</h2>
        </div>
        <KeyRound size={18} />
      </div>
      <div className="settings-grid">
        <label>
          Current password
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </label>
        <label>
          New password
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
      </div>
      <button className="button primary" type="button" onClick={savePassword}>
        <Save size={16} /> Save password
      </button>
      {message ? <p className={`test-message ${status}`}>{message}</p> : null}
    </section>
  );
}
