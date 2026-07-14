"use client";

import { useState } from "react";
import { Image, Mic, Save, Search, SlidersHorizontal, Sparkles, Waves } from "lucide-react";
import { BudgetSettings, ProviderConfig, RouterSettings } from "@/core/types";
import { SaverLevel } from "@/core/tokenSaver";
import { adminFetch } from "@/lib/adminFetch";

const saverLevels: SaverLevel[] = ["off", "lite", "full", "ultra"];

export default function SettingsPanel({
  budget,
  router,
  providers
}: {
  budget: BudgetSettings;
  router: RouterSettings;
  providers: ProviderConfig[];
}) {
  const [budgetDraft, setBudgetDraft] = useState(budget);
  const [routerDraft, setRouterDraft] = useState({
    ...router,
    rtkEnabled: router.rtkEnabled ?? true,
    tokenSaver: router.tokenSaver ?? { caveman: "lite", ponytail: "off" },
    headroomEnabled: router.headroomEnabled ?? false,
    headroomUrl: router.headroomUrl ?? "http://localhost:8787",
    headroomCompressUserMessages: router.headroomCompressUserMessages ?? false,
    pxpipeEnabled: router.pxpipeEnabled ?? false,
    publicBaseUrl: router.publicBaseUrl ?? "",
    maxConcurrentUpstream: router.maxConcurrentUpstream ?? 0,
    maxConcurrentPerProvider: router.maxConcurrentPerProvider ?? 0,
    queueWaitMs: router.queueWaitMs ?? 30_000,
    mediaRouting: {
      searchMode: "builtin" as const,
      ...router.mediaRouting
    }
  });
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(false);
    const publicBaseUrl = routerDraft.publicBaseUrl?.trim() || undefined;
    const response = await adminFetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        budget: budgetDraft,
        router: { ...routerDraft, publicBaseUrl }
      })
    });
    if (response.ok) {
      setSaved(true);
      setTimeout(() => window.location.reload(), 450);
    }
  }

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">Public URL</p>
          <h2>Domain</h2>
        </div>
      </div>
      <p className="compact-copy">
        Set this to the HTTPS URL you open in the browser (e.g. <code>https://nesa.example.com</code>).
        OAuth and post-login redirects use it so the app returns to your domain instead of localhost.
      </p>
      <label>
        Public base URL
        <input
          suppressHydrationWarning
          type="url"
          placeholder="https://nesa.example.com"
          value={routerDraft.publicBaseUrl ?? ""}
          onChange={(event) => setRouterDraft({ ...routerDraft, publicBaseUrl: event.target.value })}
        />
      </label>
      <div className="panel-heading" style={{ marginTop: "1.5rem" }}>
        <div>
          <p className="subtle">Budget</p>
          <h2>Limits</h2>
        </div>
        <SlidersHorizontal size={18} />
      </div>
      <div className="settings-grid">
        <label>
          Daily budget
          <span className="money-input">
            <span className="currency-prefix" aria-hidden="true">
              $
            </span>
            <input
              suppressHydrationWarning
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              aria-label="Daily budget in US dollars"
              value={budgetDraft.dailyBudgetUsd}
              onChange={(event) => setBudgetDraft({ ...budgetDraft, dailyBudgetUsd: Number(event.target.value) })}
            />
            <span className="currency-suffix">USD</span>
          </span>
        </label>
        <label>
          Warning %
          <input
            suppressHydrationWarning
            type="number"
            min="1"
            max="100"
            value={budgetDraft.warningThresholdPercent}
            onChange={(event) => setBudgetDraft({ ...budgetDraft, warningThresholdPercent: Number(event.target.value) })}
          />
        </label>
        <label>
          Critical %
          <input
            suppressHydrationWarning
            type="number"
            min="1"
            max="100"
            value={budgetDraft.criticalThresholdPercent}
            onChange={(event) => setBudgetDraft({ ...budgetDraft, criticalThresholdPercent: Number(event.target.value) })}
          />
        </label>
        <label>
          Mode
          <select
            value={routerDraft.routingMode}
            onChange={(event) =>
              setRouterDraft({
                ...routerDraft,
                routingMode: event.target.value as RouterSettings["routingMode"]
              })
            }
          >
            <option value="auto">Auto</option>
            <option value="free_first">Free</option>
            <option value="cheapest">Cheap</option>
            <option value="best">Best</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label className="settings-full">
          Manual provider
          <select
            suppressHydrationWarning
            value={
              routerDraft.manualProviderId &&
              providers.some((provider) => provider.id === routerDraft.manualProviderId && provider.status === "active")
                ? routerDraft.manualProviderId
                : ""
            }
            onChange={(event) => {
              const manualProviderId = event.target.value || undefined;
              setRouterDraft({
                ...routerDraft,
                manualProviderId,
                // Always switch to Manual when a provider is pinned (dropdown is never disabled).
                routingMode: manualProviderId ? "manual" : routerDraft.routingMode
              });
            }}
          >
            <option value="">Select provider…</option>
            {providers
              .filter((provider) => provider.status === "active")
              .map((provider) => (
                <option value={provider.id} key={provider.id}>
                  {provider.name}
                </option>
              ))}
          </select>
        </label>
        {providers.every((provider) => provider.status !== "active") ? (
          <p className="subtle settings-full" style={{ margin: 0 }}>
            No active providers — enable one under Providers first.
          </p>
        ) : null}
        {routerDraft.routingMode !== "manual" && !routerDraft.manualProviderId ? (
          <p className="subtle settings-full" style={{ margin: 0 }}>
            Choosing a provider here sets Mode to Manual automatically. Then Save.
          </p>
        ) : null}
        {routerDraft.routingMode === "manual" && !routerDraft.manualProviderId ? (
          <p className="subtle settings-full" style={{ margin: 0 }}>
            Pick a provider above, then Save. Manual mode will not route until a provider is selected.
          </p>
        ) : null}
        {routerDraft.manualProviderId &&
        providers.find((provider) => provider.id === routerDraft.manualProviderId)?.status !== "active" ? (
          <p className="subtle settings-full" style={{ margin: 0 }}>
            Selected provider is not active — activate it under Providers or choose another one.
          </p>
        ) : null}
        <label className="settings-full">
          Provider strategy
          <select
            value={routerDraft.providerStrategy ?? "priority"}
            onChange={(event) => setRouterDraft({ ...routerDraft, providerStrategy: event.target.value as RouterSettings["providerStrategy"] })}
          >
            <option value="priority">Priority</option>
            <option value="round_robin">Round robin</option>
          </select>
        </label>
        <label>
          Fallback
          <select
            value={routerDraft.fallbackMode ?? "auto"}
            onChange={(event) => setRouterDraft({ ...routerDraft, fallbackMode: event.target.value as RouterSettings["fallbackMode"] })}
          >
            <option value="auto">Auto</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="check-row">
          <input
            suppressHydrationWarning
            type="checkbox"
            checked={routerDraft.evaluatorEnabled ?? true}
            onChange={(event) => setRouterDraft({ ...routerDraft, evaluatorEnabled: event.target.checked })}
          />
          Evaluator
        </label>
        <label>
          On warning
          <select
            value={budgetDraft.onWarning}
            onChange={(event) => setBudgetDraft({ ...budgetDraft, onWarning: event.target.value as BudgetSettings["onWarning"] })}
          >
            <option value="prefer_cheaper">Prefer cheaper</option>
            <option value="notify_only">Notify only</option>
          </select>
        </label>
        <label>
          On critical
          <select
            value={budgetDraft.onCritical}
            onChange={(event) => setBudgetDraft({ ...budgetDraft, onCritical: event.target.value as BudgetSettings["onCritical"] })}
          >
            <option value="free_tier_only">Free & free tier</option>
            <option value="prefer_cheaper">Prefer cheaper</option>
          </select>
        </label>
        <label>
          On exceeded
          <select
            value={budgetDraft.onExceeded}
            onChange={(event) => setBudgetDraft({ ...budgetDraft, onExceeded: event.target.value as BudgetSettings["onExceeded"] })}
          >
            <option value="block_paid">Block paid</option>
            <option value="allow_with_warning">Allow</option>
          </select>
        </label>
      </div>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.cacheEnabled}
          onChange={(event) => setRouterDraft({ ...routerDraft, cacheEnabled: event.target.checked })}
        />
        Cache
      </label>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.preferFreeTier}
          onChange={(event) => setRouterDraft({ ...routerDraft, preferFreeTier: event.target.checked })}
        />
        Free tier
      </label>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.rtkEnabled ?? false}
          onChange={(event) => setRouterDraft({ ...routerDraft, rtkEnabled: event.target.checked })}
        />
        RTK (compress tool_result — git/grep/ls/logs)
      </label>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.headroomEnabled ?? false}
          onChange={(event) => setRouterDraft({ ...routerDraft, headroomEnabled: event.target.checked })}
        />
        Headroom compress (external proxy)
      </label>
      <label>
        Headroom URL
        <input
          value={routerDraft.headroomUrl ?? "http://localhost:8787"}
          onChange={(event) => setRouterDraft({ ...routerDraft, headroomUrl: event.target.value })}
          placeholder="http://localhost:8787"
        />
      </label>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.headroomCompressUserMessages ?? false}
          onChange={(event) => setRouterDraft({ ...routerDraft, headroomCompressUserMessages: event.target.checked })}
        />
        Also compress user messages
      </label>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.pxpipeEnabled ?? false}
          onChange={(event) => setRouterDraft({ ...routerDraft, pxpipeEnabled: event.target.checked })}
        />
        pxpipe-lite (in-process tool compress)
      </label>
      <div className="panel-heading" style={{ marginTop: "1.5rem" }}>
        <div>
          <p className="subtle">Upstream load</p>
          <h2>Concurrency queue</h2>
        </div>
      </div>
      <p className="compact-copy">Limit parallel upstream calls to protect rate limits. Set a value to <code>0</code> for unlimited (default).</p>
      <div className="form-grid">
        <label>
          Max concurrent (global)
          <input
            type="number"
            min={0}
            value={routerDraft.maxConcurrentUpstream ?? 0}
            onChange={(event) =>
              setRouterDraft({ ...routerDraft, maxConcurrentUpstream: Number(event.target.value) || 0 })
            }
          />
        </label>
        <label>
          Max concurrent (per provider)
          <input
            type="number"
            min={0}
            value={routerDraft.maxConcurrentPerProvider ?? 0}
            onChange={(event) =>
              setRouterDraft({ ...routerDraft, maxConcurrentPerProvider: Number(event.target.value) || 0 })
            }
          />
        </label>
        <label>
          Queue wait (ms)
          <input
            type="number"
            min={0}
            value={routerDraft.queueWaitMs ?? 30_000}
            onChange={(event) => setRouterDraft({ ...routerDraft, queueWaitMs: Number(event.target.value) || 0 })}
          />
        </label>
      </div>
      <div className="panel-heading" style={{ marginTop: "1.5rem" }}>
        <div>
          <p className="subtle">Media APIs</p>
          <h2>Media routing</h2>
        </div>
        <Sparkles size={18} />
      </div>
      <p className="compact-copy">
        Pin images, speech, transcriptions, and embeddings to a specific OpenAI-compatible provider, or leave on Auto to use the main routing engine.
        Web search uses the built-in DuckDuckGo endpoint (no provider key).
      </p>
      <div className="settings-grid">
        <MediaProviderSelect
          label="Images"
          icon={<Image size={15} />}
          value={routerDraft.mediaRouting?.imagesProviderId ?? ""}
          providers={providers}
          onChange={(imagesProviderId) =>
            setRouterDraft({
              ...routerDraft,
              mediaRouting: { ...routerDraft.mediaRouting, imagesProviderId: imagesProviderId || undefined }
            })
          }
        />
        <MediaProviderSelect
          label="Speech (TTS)"
          icon={<Mic size={15} />}
          value={routerDraft.mediaRouting?.speechProviderId ?? ""}
          providers={providers}
          onChange={(speechProviderId) =>
            setRouterDraft({
              ...routerDraft,
              mediaRouting: { ...routerDraft.mediaRouting, speechProviderId: speechProviderId || undefined }
            })
          }
        />
        <MediaProviderSelect
          label="Transcriptions (STT)"
          icon={<Waves size={15} />}
          value={routerDraft.mediaRouting?.transcriptionsProviderId ?? ""}
          providers={providers}
          onChange={(transcriptionsProviderId) =>
            setRouterDraft({
              ...routerDraft,
              mediaRouting: { ...routerDraft.mediaRouting, transcriptionsProviderId: transcriptionsProviderId || undefined }
            })
          }
        />
        <MediaProviderSelect
          label="Embeddings"
          icon={<Sparkles size={15} />}
          value={routerDraft.mediaRouting?.embeddingsProviderId ?? ""}
          providers={providers}
          onChange={(embeddingsProviderId) =>
            setRouterDraft({
              ...routerDraft,
              mediaRouting: { ...routerDraft.mediaRouting, embeddingsProviderId: embeddingsProviderId || undefined }
            })
          }
        />
        <label>
          <span className="label-with-icon"><Search size={15} /> Web search</span>
          <input readOnly value="Built-in (DuckDuckGo)" />
        </label>
      </div>
      <label>
        Caveman
        <select
          value={routerDraft.tokenSaver?.caveman ?? "off"}
          onChange={(event) => setRouterDraft({ ...routerDraft, tokenSaver: { ...routerDraft.tokenSaver!, caveman: event.target.value as SaverLevel } })}
        >
          {saverLevels.map((level) => <option key={level} value={level}>{level}</option>)}
        </select>
      </label>
      <label>
        Ponytail
        <select
          value={routerDraft.tokenSaver?.ponytail ?? "off"}
          onChange={(event) => setRouterDraft({ ...routerDraft, tokenSaver: { ...routerDraft.tokenSaver!, ponytail: event.target.value as SaverLevel } })}
        >
          {saverLevels.map((level) => <option key={level} value={level}>{level}</option>)}
        </select>
      </label>
      <button className="button primary" type="button" onClick={save}>
        <Save size={16} />
        {saved ? "Saved" : "Save"}
      </button>
    </section>
  );
}

function MediaProviderSelect({
  label,
  icon,
  value,
  providers,
  onChange
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  providers: ProviderConfig[];
  onChange: (value: string) => void;
}) {
  const openAiProviders = providers.filter((provider) => provider.type === "openai_compatible");
  return (
    <label>
      <span className="label-with-icon">{icon} {label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Auto (routing engine)</option>
        {openAiProviders.map((provider) => (
          <option value={provider.id} key={provider.id}>
            {provider.name} ({provider.status})
          </option>
        ))}
      </select>
    </label>
  );
}
