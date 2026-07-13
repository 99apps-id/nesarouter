"use client";

import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface KeyRow {
  id: string;
  preview: string;
}

export default function KeysManager({ initialKeys }: { initialKeys: KeyRow[] }) {
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys);
  const [newKey, setNewKey] = useState<{ token: string; id: string; preview: string } | null>(null);
  const [error, setError] = useState("");

  async function createKey() {
    setNewKey(null);
    setError("");
    const response = await fetch("/api/keys", { method: "POST", credentials: "same-origin" });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setError("Session expired. Please log in again.");
      window.setTimeout(() => {
        window.location.href = "/login?next=%2Fkeys";
      }, 600);
      return;
    }
    if (!response.ok) {
      setError(result.error ?? "Failed to create key.");
      return;
    }
    setNewKey({ token: result.token, id: result.id, preview: result.preview });
    setKeys((items) => [{ id: result.id, preview: result.preview }, ...items.filter((item) => item.id !== result.id)]);
  }

  async function revokeKey(id: string) {
    setError("");
    const response = await fetch("/api/keys", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id })
    });
    if (response.status === 401) {
      setError("Session expired. Please log in again.");
      window.setTimeout(() => {
        window.location.href = "/login?next=%2Fkeys";
      }, 600);
      return;
    }
    if (!response.ok) return;
    setKeys((items) => items.filter((item) => item.id !== id));
    if (newKey?.id === id) setNewKey(null);
  }

  async function copyKey(token: string) {
    await navigator.clipboard.writeText(token);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">Client keys</p>
          <h2>{keys.length} keys.</h2>
        </div>
        <button className="button primary inline-button" type="button" onClick={createKey}>
          <Plus size={16} /> New key
        </button>
      </div>

      {newKey ? (
        <div className="key-reveal">
          <KeyRound size={16} />
          <code>{newKey.token}</code>
          <button className="button inline-button" type="button" onClick={() => copyKey(newKey.token)}>
            <Copy size={15} /> Copy
          </button>
        </div>
      ) : null}

      <p className="compact-copy">
        Full key is shown only once when created. Copy it now — existing keys cannot be recovered.
      </p>
      {error ? <p className="test-message error">{error}</p> : null}

      <div className="key-list">
        {keys.map((row) => (
          <div className="key-row" key={row.id}>
            <code>{row.preview}</code>
            <div className="button-row">
              <button className="button inline-button danger-button" type="button" onClick={() => revokeKey(row.id)}>
                <Trash2 size={15} /> Revoke
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
