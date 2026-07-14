"use client";

import { useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { ModelAlias } from "@/core/aliases";
import { Combo, ProviderConfig } from "@/core/types";
import { adminFetch } from "@/lib/adminFetch";

export default function AliasesManager({
  aliases,
  providers,
  combos
}: {
  aliases: ModelAlias[];
  providers: ProviderConfig[];
  combos: Combo[];
}) {
  const [draft, setDraft] = useState<ModelAlias>({ id: "", alias: "", target: "" });
  const [items, setItems] = useState(aliases);
  const [saved, setSaved] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function persist(next: ModelAlias[]) {
    setSaved(false);
    const stateRes = await adminFetch("/api/state");
    if (!stateRes.ok) return;
    const state = await stateRes.json();
    const response = await adminFetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ budget: state.budget, router: state.router, combos: state.combos, aliases: next })
    });
    if (response.ok) {
      setItems(next);
      setSaved(true);
    }
  }

  async function add() {
    const alias = draft.alias.trim();
    const target = draft.target.trim();
    if (!alias || !target) return;
    const id = draft.id.trim() || alias.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const next = [...items.filter((item) => item.alias.toLowerCase() !== alias.toLowerCase()), { id, alias, target }];
    setDraft({ id: "", alias: "", target: "" });
    await persist(next);
  }

  async function remove(id: string) {
    await persist(items.filter((item) => item.id !== id));
  }

  async function importNineRouter() {
    setImportMsg(null);
    const raw = importText.trim();
    if (!raw) {
      setImportMsg("Paste JSON from 9router GET /api/models/alias first.");
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      setImportMsg("Invalid JSON.");
      return;
    }
    setImporting(true);
    try {
      const response = await adminFetch("/api/aliases/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setImportMsg(typeof data?.error === "string" ? data.error : "Import failed.");
        return;
      }
      if (Array.isArray(data.aliases)) setItems(data.aliases);
      setImportMsg(`Imported: ${data.added ?? 0} added, ${data.updated ?? 0} updated, ${data.skipped ?? 0} skipped.`);
      setImportText("");
      setSaved(true);
    } finally {
      setImporting(false);
    }
  }

  const targetOptions = [
    ...providers.map((provider) => ({ value: provider.model, label: `${provider.name} (${provider.model})` })),
    ...combos.map((combo) => ({ value: combo.name, label: `combo: ${combo.name}` }))
  ];
  const targets = Array.from(
    targetOptions.reduce((unique, target) => {
      if (!unique.has(target.value)) unique.set(target.value, target);
      return unique;
    }, new Map<string, { value: string; label: string }>()).values()
  );

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">Short model names</p>
          <h2>Aliases</h2>
        </div>
      </div>
      <p className="compact-copy">
        Map <code>model: &quot;fast&quot;</code> to a provider model or combo. Call Codex with <code>cx/gpt-…</code>
        (e.g. <code>cx/gpt-5.6-sol</code>), Claude with <code>cc/…</code>, and other providers with their short prefixes.
      </p>
      <div className="combo-list">
        {items.length === 0 ? <p className="subtle">No aliases yet.</p> : null}
        {items.map((item) => (
          <article key={item.id} className="combo-item">
            <div>
              <strong>{item.alias}</strong>
              <span>→ {item.target}</span>
            </div>
            <button className="button danger-button" type="button" onClick={() => remove(item.id)}>
              <Trash2 size={16} /> Delete
            </button>
          </article>
        ))}
      </div>
      <div className="combo-form">
        <label>
          Alias
          <input value={draft.alias} placeholder="fast" onChange={(event) => setDraft({ ...draft, alias: event.target.value })} />
        </label>
        <label>
          Target
          <input
            list="alias-targets"
            value={draft.target}
            placeholder="provider model or combo name"
            onChange={(event) => setDraft({ ...draft, target: event.target.value })}
          />
          <datalist id="alias-targets">
            {targets.map((target) => (
              <option key={target.value} value={target.value}>{target.label}</option>
            ))}
          </datalist>
        </label>
        <button className="button primary" type="button" onClick={add}>
          <Plus size={16} /> {saved ? "Saved" : "Add alias"}
        </button>
      </div>
      <div className="combo-form" style={{ marginTop: "1rem", flexDirection: "column", alignItems: "stretch" }}>
        <label>
          Import 9router JSON
          <textarea
            value={importText}
            rows={4}
            placeholder='{"aliases":{"fast":"or/meta-llama/..."}}'
            onChange={(event) => setImportText(event.target.value)}
          />
        </label>
        <button className="button" type="button" disabled={importing} onClick={importNineRouter}>
          <Upload size={16} /> {importing ? "Importing…" : "Import 9router JSON"}
        </button>
        {importMsg ? <p className="subtle">{importMsg}</p> : null}
      </div>
    </section>
  );
}
