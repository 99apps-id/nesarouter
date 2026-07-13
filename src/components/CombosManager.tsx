"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Combo, ProviderConfig } from "@/core/types";

export default function CombosManager({
  combos,
  providers
}: {
  combos: Combo[];
  providers: ProviderConfig[];
}) {
  const [draft, setDraft] = useState<Combo>({
    id: "",
    name: "",
    providerIds: [],
    strategy: "fallback"
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function toggleProvider(providerId: string) {
    setDraft((prev) => ({
      ...prev,
      providerIds: prev.providerIds.includes(providerId)
        ? prev.providerIds.filter((id) => id !== providerId)
        : [...prev.providerIds, providerId]
    }));
  }

  function move(providerId: string, direction: -1 | 1) {
    setDraft((prev) => {
      const ids = [...prev.providerIds];
      const index = ids.indexOf(providerId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ids.length) return prev;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      return { ...prev, providerIds: ids };
    });
  }

  async function save() {
    setSaved(false);
    setError("");
    const id = draft.id.trim() || draft.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    if (!id || !draft.name.trim() || draft.providerIds.length === 0) return;
    const response = await fetch("/api/combos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, id })
    });
    if (response.ok) {
      setSaved(true);
      setDraft({ id: "", name: "", providerIds: [], strategy: "fallback" });
      setTimeout(() => window.location.reload(), 450);
    } else {
      const result = await response.json().catch(() => ({}));
      setError(result.error || "Could not create combo.");
    }
  }

  async function remove(id: string) {
    const response = await fetch("/api/combos", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (response.ok) window.location.reload();
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">Named fallback chains</p>
          <h2>Combos</h2>
        </div>
      </div>
      <p className="compact-copy">
        Request with <code>model: &quot;combo-name&quot;</code> to route through the ordered providers below.
      </p>

      <div className="combo-list">
        {combos.length === 0 ? (
          <p className="subtle">No combos yet. Create one to enable named multi-provider routing.</p>
        ) : (
          combos.map((combo) => (
            <article key={combo.id} className="combo-item">
              <div>
                <strong>{combo.name}</strong>
                <span>{combo.strategy}</span>
              </div>
              <ol className="combo-chain">
                {combo.providerIds.map((id) => {
                  const provider = providers.find((p) => p.id === id);
                  return <li key={id}>{provider?.name ?? id}</li>;
                })}
              </ol>
              <button className="button danger-button" type="button" onClick={() => remove(combo.id)}>
                <Trash2 size={16} /> Delete
              </button>
            </article>
          ))
        )}
      </div>

      <div className="combo-form">
        <label>
          Name
          <input
            suppressHydrationWarning
            value={draft.name}
            placeholder="my-coding-stack"
            onChange={(event) => setDraft({ ...draft, name: event.target.value, id: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
          />
        </label>
        <label>
          Strategy
          <select value={draft.strategy} onChange={(event) => setDraft({ ...draft, strategy: event.target.value as Combo["strategy"] })}>
            <option value="fallback">Fallback (ordered)</option>
            <option value="round_robin">Round robin</option>
          </select>
        </label>
        <fieldset className="combo-providers">
          <legend>Providers (pick order)</legend>
          {providers.map((provider) => {
            const order = draft.providerIds.indexOf(provider.id);
            return (
              <label key={provider.id} className={`combo-pick ${order >= 0 ? "selected" : ""}`}>
                <input
                  suppressHydrationWarning
                  type="checkbox"
                  checked={order >= 0}
                  onChange={() => toggleProvider(provider.id)}
                />
                <span>{provider.name}</span>
                {order >= 0 ? <small className="combo-order">{order + 1}</small> : null}
                {order > 0 ? (
                  <button type="button" className="link-button" onClick={() => move(provider.id, -1)}>▲</button>
                ) : null}
                {order >= 0 && order < draft.providerIds.length - 1 ? (
                  <button type="button" className="link-button" onClick={() => move(provider.id, 1)}>▼</button>
                ) : null}
              </label>
            );
          })}
        </fieldset>
        <button className="button primary" type="button" onClick={save} disabled={draft.providerIds.length === 0 || !draft.name.trim()}>
          <Plus size={16} /> {saved ? "Saved" : "Create combo"}
        </button>
        {error ? <p className="test-message">{error}</p> : null}
      </div>
    </section>
  );
}
