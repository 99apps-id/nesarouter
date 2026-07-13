"use client";

import { ListRestart, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { ProviderConfig } from "@/core/types";
import { customProviderTemplate, providerPresetGroups, providerPresets } from "@/lib/providerPresets";
import NoAutofillInput from "@/components/NoAutofillInput";

export default function NewProviderForm() {
  const [draft, setDraft] = useState<ProviderConfig>(customProviderTemplate());
  const [presetId, setPresetId] = useState("");
  const [presetFilter, setPresetFilter] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsMessage, setModelsMessage] = useState("");
  const [modelsResult, setModelsResult] = useState<"idle" | "ok" | "error">("idle");
  const [seedMessage, setSeedMessage] = useState("");

  const oauthPresets = useMemo(
    () => providerPresets.filter((item) => Boolean(item.oauthProfile)),
    []
  );

  const filteredGroups = useMemo(() => {
    const q = presetFilter.trim().toLowerCase();
    if (!q) return providerPresetGroups;
    return providerPresetGroups
      .map((group) => ({
        ...group,
        ids: group.ids.filter((id) => {
          const preset = providerPresets.find((item) => item.id === id);
          if (!preset) return false;
          const hay = `${preset.name} ${preset.id} ${preset.baseUrl} ${preset.oauthProfile ?? ""} oauth`.toLowerCase();
          return hay.includes(q);
        })
      }))
      .filter((group) => group.ids.length > 0);
  }, [presetFilter]);

  function applyPreset(id: string) {
    setPresetId(id);
    setModels([]);
    setModelsMessage("");
    setModelsResult("idle");
    if (!id) {
      setDraft(customProviderTemplate());
      return;
    }
    const preset = providerPresets.find((item) => item.id === id);
    if (!preset) {
      setDraft(customProviderTemplate());
      return;
    }
    // Keep stable catalog ids for OAuth so Connect lands on the seeded card.
    if (preset.oauthProfile) {
      setDraft({
        ...preset,
        apiKey: "",
        apiKeys: [],
        models: Array.isArray(preset.models) ? [...preset.models] : preset.model ? [preset.model] : []
      });
      return;
    }
    setDraft({
      ...preset,
      id: `${preset.id}-${Date.now().toString(36)}`,
      apiKey: "",
      apiKeys: [],
      models: Array.isArray(preset.models) ? [...preset.models] : preset.model ? [preset.model] : []
    });
  }

  async function syncCatalog() {
    setSeedMessage("");
    const response = await fetch("/api/providers/seed", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSeedMessage(result.error ?? "Failed to sync catalog.");
      return;
    }
    setSeedMessage(result.count ? `Added ${result.count} presets: ${(result.added ?? []).join(", ")}` : "Catalog already up to date.");
    if (result.count) window.location.reload();
  }

  async function addProvider() {
    const rawId = draft.oauthProfile ? draft.id : draft.id || draft.name || draft.model;
    const id = rawId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!id || !draft.baseUrl || !draft.model) return;
    const provider: ProviderConfig = {
      ...draft,
      id,
      name: draft.name || id,
      status: "disabled",
      priority: Number(draft.priority || 100),
      inputCostPerMTok: Number(draft.inputCostPerMTok || 0),
      outputCostPerMTok: Number(draft.outputCostPerMTok || 0),
      models: Array.from(new Set([draft.model, ...(draft.models ?? [])])).filter(Boolean),
      oauthProfile: draft.oauthProfile
    };
    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(provider)
    });
    if (response.ok) {
      if (provider.oauthProfile) window.location.href = `/providers/${provider.id}`;
      else window.location.reload();
    }
  }

  async function loadModels() {
    setModelsLoading(true);
    setModelsMessage("");
    const provider: ProviderConfig = {
      ...draft,
      id: draft.id || "draft-provider",
      name: draft.name || "Draft provider",
      status: "disabled",
      priority: Number(draft.priority || 100),
      inputCostPerMTok: Number(draft.inputCostPerMTok || 0),
      outputCostPerMTok: Number(draft.outputCostPerMTok || 0)
    };
    const response = await fetch("/api/providers/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider })
    });
    const result = await response.json();
    if (result.ok) {
      setModels(result.models);
      setModelsResult("ok");
      setModelsMessage(`${result.models.length} models loaded.`);
      if (!draft.model && result.models[0]) setDraft({ ...draft, model: result.models[0] });
    } else {
      setModelsResult("error");
      setModelsMessage(result.error ?? "Failed to load models.");
    }
    setModelsLoading(false);
  }

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">Add</p>
          <h2>New provider</h2>
        </div>
        <button className="button" type="button" onClick={syncCatalog} title="Insert missing catalog presets into the pool">
          <RefreshCw size={16} /> Sync catalog
        </button>
      </div>

      <div className="oauth-quick-add">
        <p className="subtle">OAuth subscription (Connect or device flow after add — no API key)</p>
        <div className="button-row">
          {(["oauth-github-copilot", "oauth-chatgpt", "oauth-kiro", "oauth-antigravity", "oauth-cursor"] as const)
            .map((id) => providerPresets.find((item) => item.id === id))
            .flatMap((item) => (item ? [item] : []))
            .map((item) => (
              <button
                key={item.id}
                className="button"
                type="button"
                onClick={() => applyPreset(item.id)}
              >
                {item.name.replace(/\s*\(.*$/, "")}
              </button>
            ))}
        </div>
      </div>

      <form className="settings-grid" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
        <label>
          Filter presets
          <input
            value={presetFilter}
            onChange={(event) => setPresetFilter(event.target.value)}
            placeholder="e.g. oauth, claude, runware…"
          />
        </label>
        <label>
          Preset
          <select value={presetId} onChange={(event) => applyPreset(event.target.value)}>
            <option value="">Custom</option>
            {filteredGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.ids.map((id) => {
                  const preset = providerPresets.find((item) => item.id === id);
                  if (!preset) return null;
                  return (
                    <option value={preset.id} key={preset.id}>
                      {preset.oauthProfile ? `[OAuth] ${preset.name}` : preset.name}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Name
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="OpenRouter" />
        </label>
        <label>
          Adapter
          <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ProviderConfig["type"] })}>
            <option value="openai_compatible">OpenAI API</option>
            <option value="gemini">Gemini</option>
            <option value="gemini_cli">Gemini CLI (Cloud Code)</option>
            <option value="anthropic_messages">Anthropic Messages</option>
            <option value="openai_responses">OpenAI Responses</option>
            <option value="github_copilot">GitHub Copilot</option>
            <option value="kiro">Kiro / custom transport</option>
            <option value="cursor">Cursor IDE</option>
          </select>
        </label>
        <label>
          Tier
          <select value={draft.tier} onChange={(event) => setDraft({ ...draft, tier: event.target.value as ProviderConfig["tier"] })}>
            <option value="free">Free</option>
            <option value="cheap">Cheap</option>
            <option value="balanced">Balanced</option>
            <option value="premium">Premium</option>
          </select>
        </label>
        <label>
          Model
          {models.length ? (
            <select value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })}>
              {draft.model && !models.includes(draft.model) ? <option value={draft.model}>{draft.model}</option> : null}
              {models.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : (
            <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="model-name" />
          )}
        </label>
        <label>
          Base URL
          <NoAutofillInput value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" />
        </label>
        {draft.oauthProfile ? (
          <label>
            Auth
            <input readOnly value={`OAuth · ${draft.oauthProfile} (Connect after Add)`} />
          </label>
        ) : (
          <label>
            API key
            <NoAutofillInput sensitive type="password" value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} placeholder="Paste key, without Bearer" />
          </label>
        )}
        <label>
          Priority
          <input
            type="number"
            min="1"
            step="1"
            value={draft.priority}
            onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })}
          />
        </label>
        <label>
          Input $/MTok
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.inputCostPerMTok}
            onChange={(event) => setDraft({ ...draft, inputCostPerMTok: Number(event.target.value) })}
          />
        </label>
        <label>
          Output $/MTok
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.outputCostPerMTok}
            onChange={(event) => setDraft({ ...draft, outputCostPerMTok: Number(event.target.value) })}
          />
        </label>
      </form>
      {seedMessage ? <p className="subtle">{seedMessage}</p> : null}
      {modelsMessage ? <p className={`test-message ${modelsResult}`}>{modelsMessage}</p> : null}
      {!draft.oauthProfile ? (
        <button className="button" type="button" onClick={loadModels}>
          <ListRestart size={16} /> {modelsLoading ? "Loading" : "Load models"}
        </button>
      ) : null}
      <button className="button primary" type="button" onClick={addProvider}>
        <Plus size={16} /> {draft.oauthProfile ? "Add & open Connect" : "Add provider"}
      </button>
    </section>
  );
}
