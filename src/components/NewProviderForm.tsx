"use client";

import { ListRestart, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { ProviderConfig } from "@/core/types";
import { ADMIN_SESSION_EXPIRED, adminFetch, isAdminUnauthorized, scheduleLoginRedirect } from "@/lib/adminFetch";
import { customProviderTemplate, providerPresetGroups, providerPresets } from "@/lib/providerPresets";
import {
  extractCloudflareAccountId,
  isCloudflareWorkersAiProvider,
  withCloudflareAccountId
} from "@/lib/cloudflareWorkersAi";

export default function NewProviderForm() {
  const [draft, setDraft] = useState<ProviderConfig>(customProviderTemplate());
  const [presetId, setPresetId] = useState("");
  const [presetFilter, setPresetFilter] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formResult, setFormResult] = useState<"idle" | "ok" | "error">("idle");
  const [modelsMessage, setModelsMessage] = useState("");
  const [modelsResult, setModelsResult] = useState<"idle" | "ok" | "error">("idle");
  const [seedMessage, setSeedMessage] = useState("");

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

  function setError(message: string) {
    setFormResult("error");
    setFormMessage(message);
  }

  function applyPreset(id: string) {
    setPresetId(id);
    setModels([]);
    setModelsMessage("");
    setModelsResult("idle");
    setFormMessage("");
    setFormResult("idle");
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
    const response = await adminFetch("/api/providers/seed", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (isAdminUnauthorized(response)) {
      setSeedMessage(ADMIN_SESSION_EXPIRED);
      scheduleLoginRedirect();
      return;
    }
    if (!response.ok) {
      setSeedMessage(result.error ?? "Failed to sync catalog.");
      return;
    }
    setSeedMessage(result.count ? `Added ${result.count} presets: ${(result.added ?? []).join(", ")}` : "Catalog already up to date.");
    if (result.count) window.location.reload();
  }

  async function addProvider() {
    if (saving) return;
    setFormMessage("");
    setFormResult("idle");

    const rawId = draft.oauthProfile ? draft.id : draft.id || draft.name || draft.model;
    const id = String(rawId ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!draft.name.trim() && !id) {
      setError("Fill in a Name (or Model) so the provider id can be generated.");
      return;
    }
    if (!draft.baseUrl.trim()) {
      setError("Base URL is required. Example: https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1");
      return;
    }
    if (isCloudflareWorkersAiProvider(draft) && draft.baseUrl.includes("YOUR_ACCOUNT_ID")) {
      setError("Enter your Cloudflare Account ID (Workers AI → Use REST API) — it updates the Base URL.");
      return;
    }
    if (draft.type === "grok_web" && !draft.apiKey.trim()) {
      setError("Paste the grok.com SSO cookie (DevTools → Application → Cookies → sso).");
      return;
    }
    if (!draft.model.trim()) {
      setError("Model is required. Example: @cf/meta/llama-3.1-8b-instruct");
      return;
    }
    if (!id) {
      setError("Could not build a valid provider id from Name/Model. Use letters or numbers.");
      return;
    }

    const provider: ProviderConfig = {
      ...draft,
      id,
      name: draft.name.trim() || id,
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
      status: "disabled",
      priority: Number(draft.priority || 100),
      inputCostPerMTok: Number(draft.inputCostPerMTok || 0),
      outputCostPerMTok: Number(draft.outputCostPerMTok || 0),
      models: Array.from(new Set([draft.model.trim(), ...(draft.models ?? [])])).filter(Boolean),
      oauthProfile: draft.oauthProfile
    };

    setSaving(true);
    try {
      const response = await adminFetch("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(provider)
      });
      const result = await response.json().catch(() => ({}));
      if (isAdminUnauthorized(response)) {
        setError(ADMIN_SESSION_EXPIRED);
        scheduleLoginRedirect();
        return;
      }
      if (!response.ok) {
        setError(result.error ?? `Failed to add provider (HTTP ${response.status}).`);
        return;
      }
      setFormResult("ok");
      setFormMessage(`Added ${provider.name}.`);
      if (provider.oauthProfile) window.location.href = `/providers/${provider.id}`;
      else window.location.href = `/providers/${provider.id}`;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to add provider.");
    } finally {
      setSaving(false);
    }
  }

  async function loadModels() {
    if (modelsLoading) return;
    if (!draft.baseUrl.trim()) {
      setModelsResult("error");
      setModelsMessage("Set Base URL first, then Load models.");
      return;
    }
    setModelsLoading(true);
    setModelsMessage("");
    const provider: ProviderConfig = {
      ...draft,
      id: draft.id || "draft-provider",
      name: draft.name || "Draft provider",
      baseUrl: draft.baseUrl.trim(),
      status: "disabled",
      priority: Number(draft.priority || 100),
      inputCostPerMTok: Number(draft.inputCostPerMTok || 0),
      outputCostPerMTok: Number(draft.outputCostPerMTok || 0)
    };
    try {
      const response = await adminFetch("/api/providers/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider })
      });
      const result = await response.json().catch(() => ({}));
      if (isAdminUnauthorized(response)) {
        setModelsResult("error");
        setModelsMessage(ADMIN_SESSION_EXPIRED);
        scheduleLoginRedirect();
        return;
      }
      if (result.ok) {
        setModels(result.models);
        setModelsResult("ok");
        setModelsMessage(`${result.models.length} models loaded.`);
        if (!draft.model && result.models[0]) setDraft({ ...draft, model: result.models[0] });
      } else {
        setModelsResult("error");
        setModelsMessage(result.error ?? "Failed to load models. You can still type the model id manually and Add provider.");
      }
    } catch (error) {
      setModelsResult("error");
      setModelsMessage(error instanceof Error ? error.message : "Failed to load models.");
    } finally {
      setModelsLoading(false);
    }
  }

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <h2>Add provider</h2>
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
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Cloudflare Workers AI" />
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
            <option value="vertex">Vertex AI (ADC / SA / key)</option>
            <option value="opencode">OpenCode Zen</option>
            <option value="grok_web">Grok Web (SSO cookie)</option>
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
            <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="@cf/meta/llama-3.1-8b-instruct" />
          )}
        </label>
        <label>
          Base URL
          <input
            value={draft.baseUrl}
            onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
            placeholder="https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {isCloudflareWorkersAiProvider(draft) && draft.type !== "vertex" ? (
          <label>
            Cloudflare Account ID
            <input
              value={extractCloudflareAccountId(draft.baseUrl, draft.oauthProjectId)}
              onChange={(event) => {
                const accountId = event.target.value;
                setDraft({
                  ...draft,
                  oauthProjectId: accountId || undefined,
                  baseUrl: withCloudflareAccountId(draft.baseUrl, accountId)
                });
              }}
              placeholder="From Workers AI → Use REST API"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}
        {draft.type === "vertex" ? (
          <>
            <label>
              GCP Project ID
              <input
                value={draft.oauthProjectId ?? ""}
                onChange={(event) => setDraft({ ...draft, oauthProjectId: event.target.value || undefined })}
                placeholder={
                  draft.id.includes("vertex-claude") || draft.model.startsWith("claude")
                    ? "my-gcp-project (required · SA/ADC only)"
                    : "my-gcp-project (required for ADC/SA)"
                }
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              Vertex location
              <input
                value={draft.vertexLocation ?? (draft.id.includes("vertex-claude") ? "global" : "us-central1")}
                onChange={(event) => setDraft({ ...draft, vertexLocation: event.target.value || undefined })}
                placeholder={draft.id.includes("vertex-claude") ? "global" : "us-central1"}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </>
        ) : null}
        {draft.oauthProfile ? (
          <label>
            Auth
            <input readOnly value={`OAuth · ${draft.oauthProfile} (Connect after Add)`} />
          </label>
        ) : (
          <label>
            {draft.type === "vertex"
              ? "SA / ADC JSON or API key"
              : draft.type === "grok_web"
                ? "Grok SSO cookie"
                : "API key"}
            <input
              type="password"
              value={draft.apiKey}
              onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
              placeholder={
                draft.type === "vertex"
                  ? "Paste service account JSON, ADC JSON, or API key"
                  : draft.type === "grok_web"
                    ? "sso=… or raw cookie value from grok.com"
                    : "Paste Cloudflare API token"
              }
              autoComplete="new-password"
              spellCheck={false}
            />
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
      {formMessage ? <p className={`test-message ${formResult === "ok" ? "ok" : "error"}`}>{formMessage}</p> : null}
      {modelsMessage ? <p className={`test-message ${modelsResult === "ok" ? "ok" : "error"}`}>{modelsMessage}</p> : null}
      {!draft.oauthProfile ? (
        <button className="button" type="button" onClick={loadModels} disabled={modelsLoading}>
          <ListRestart size={16} /> {modelsLoading ? "Loading…" : "Load models"}
        </button>
      ) : null}
      <button className="button primary" type="button" onClick={addProvider} disabled={saving}>
        <Plus size={16} /> {saving ? "Saving…" : draft.oauthProfile ? "Add & open Connect" : "Add provider"}
      </button>
      {draft.baseUrl.includes("YOUR_ACCOUNT_ID") || draft.baseUrl.includes("YOUR_RESOURCE") ? (
        <p className="test-message error">
          {draft.baseUrl.includes("YOUR_RESOURCE")
            ? "Replace YOUR_RESOURCE in Base URL with your Azure OpenAI resource name. Model must match the deployment name."
            : "Fill Cloudflare Account ID above (or replace YOUR_ACCOUNT_ID in Base URL), then paste the API token."}
        </p>
      ) : null}
      <p className="subtle">Custom tip: leave Preset on Custom, fill Name + Base URL + Model (+ API key), then Add. Load models is optional.</p>
    </section>
  );
}
