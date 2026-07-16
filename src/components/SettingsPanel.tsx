"use client";

import { useState } from "react";
import { Image, Mic, Save, Search, SlidersHorizontal, Sparkles, Waves } from "lucide-react";
import { BudgetSettings, ProviderConfig, RouterSettings } from "@/core/types";
import { SaverLevel } from "@/core/tokenSaver";
import { adminFetch } from "@/lib/adminFetch";
import { useI18n } from "@/components/I18nProvider";

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
  const { t } = useI18n();
  const s = t.settings;
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
  const [error, setError] = useState("");

  async function save() {
    setSaved(false);
    setError("");
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
    } else setError((await response.json().catch(() => ({}))).error ?? "Failed to save routing settings.");
  }

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">{s.publicUrlSubtle}</p>
          <h2>{s.domain}</h2>
        </div>
      </div>
      <p className="compact-copy">{s.publicUrlBody}</p>
      <label>
        {s.publicBaseUrl}
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
          <p className="subtle">{s.budgetSubtle}</p>
          <h2>{s.limits}</h2>
        </div>
        <SlidersHorizontal size={18} />
      </div>
      <div className="settings-grid">
        <label>
          {s.dailyBudget}
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
              aria-label={s.dailyBudgetAria}
              value={budgetDraft.dailyBudgetUsd}
              onChange={(event) => setBudgetDraft({ ...budgetDraft, dailyBudgetUsd: Number(event.target.value) })}
            />
            <span className="currency-suffix">USD</span>
          </span>
        </label>
        <label>
          {s.warningPct}
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
          {s.criticalPct}
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
          {s.mode}
          <select
            value={routerDraft.routingMode}
            onChange={(event) =>
              setRouterDraft({
                ...routerDraft,
                routingMode: event.target.value as RouterSettings["routingMode"]
              })
            }
          >
            <option value="auto">{s.modeAuto}</option>
            <option value="free_first">{s.modeFree}</option>
            <option value="cheapest">{s.modeCheap}</option>
            <option value="best">{s.modeBest}</option>
            <option value="manual">{s.modeManual}</option>
          </select>
        </label>
        <label className="settings-full">
          {s.manualProvider}
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
                routingMode: manualProviderId ? "manual" : routerDraft.routingMode
              });
            }}
          >
            <option value="">{s.selectProvider}</option>
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
            {s.noActiveProviders}
          </p>
        ) : null}
        {routerDraft.routingMode !== "manual" && !routerDraft.manualProviderId ? (
          <p className="subtle settings-full" style={{ margin: 0 }}>
            {s.choosingSetsManual}
          </p>
        ) : null}
        {routerDraft.routingMode === "manual" && !routerDraft.manualProviderId ? (
          <p className="subtle settings-full" style={{ margin: 0 }}>
            {s.pickProviderManual}
          </p>
        ) : null}
        {routerDraft.manualProviderId &&
        providers.find((provider) => provider.id === routerDraft.manualProviderId)?.status !== "active" ? (
          <p className="subtle settings-full" style={{ margin: 0 }}>
            {s.selectedNotActive}
          </p>
        ) : null}
        <label className="settings-full">
          {s.providerStrategy}
          <select
            value={routerDraft.providerStrategy ?? "priority"}
            onChange={(event) => setRouterDraft({ ...routerDraft, providerStrategy: event.target.value as RouterSettings["providerStrategy"] })}
          >
            <option value="priority">{s.priority}</option>
            <option value="round_robin">{s.roundRobin}</option>
          </select>
        </label>
        <label>
          {s.fallback}
          <select
            value={routerDraft.fallbackMode ?? "auto"}
            onChange={(event) => setRouterDraft({ ...routerDraft, fallbackMode: event.target.value as RouterSettings["fallbackMode"] })}
          >
            <option value="auto">{t.common.auto}</option>
            <option value="off">{t.common.off}</option>
          </select>
        </label>
        <label className="check-row">
          <input
            suppressHydrationWarning
            type="checkbox"
            checked={routerDraft.evaluatorEnabled ?? true}
            onChange={(event) => setRouterDraft({ ...routerDraft, evaluatorEnabled: event.target.checked })}
          />
          {s.evaluator}
        </label>
        <label>
          {s.onWarning}
          <select
            value={budgetDraft.onWarning}
            onChange={(event) => setBudgetDraft({ ...budgetDraft, onWarning: event.target.value as BudgetSettings["onWarning"] })}
          >
            <option value="prefer_cheaper">{s.preferCheaper}</option>
            <option value="notify_only">{s.notifyOnly}</option>
          </select>
        </label>
        <label>
          {s.onCritical}
          <select
            value={budgetDraft.onCritical}
            onChange={(event) => setBudgetDraft({ ...budgetDraft, onCritical: event.target.value as BudgetSettings["onCritical"] })}
          >
            <option value="free_tier_only">{s.freeTierOnly}</option>
            <option value="prefer_cheaper">{s.preferCheaper}</option>
          </select>
        </label>
        <label>
          {s.onExceeded}
          <select
            value={budgetDraft.onExceeded}
            onChange={(event) => setBudgetDraft({ ...budgetDraft, onExceeded: event.target.value as BudgetSettings["onExceeded"] })}
          >
            <option value="block_paid">{s.blockPaid}</option>
            <option value="allow_with_warning">{s.allow}</option>
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
        {s.cache}
      </label>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.preferFreeTier}
          onChange={(event) => setRouterDraft({ ...routerDraft, preferFreeTier: event.target.checked })}
        />
        {s.freeTier}
      </label>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.rtkEnabled ?? false}
          onChange={(event) => setRouterDraft({ ...routerDraft, rtkEnabled: event.target.checked })}
        />
        {s.rtk}
      </label>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.headroomEnabled ?? false}
          onChange={(event) => setRouterDraft({ ...routerDraft, headroomEnabled: event.target.checked })}
        />
        {s.headroomCompress}
      </label>
      <label>
        {s.headroomUrl}
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
        {s.compressUserMessages}
      </label>
      <label className="check-row">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={routerDraft.pxpipeEnabled ?? false}
          onChange={(event) => setRouterDraft({ ...routerDraft, pxpipeEnabled: event.target.checked })}
        />
        {s.pxpipe}
      </label>
      <div className="panel-heading" style={{ marginTop: "1.5rem" }}>
        <div>
          <p className="subtle">{s.upstreamLoad}</p>
          <h2>{s.concurrencyQueue}</h2>
        </div>
      </div>
      <p className="compact-copy">{s.concurrencyBody}</p>
      <div className="form-grid">
        <label>
          {s.maxConcurrentGlobal}
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
          {s.maxConcurrentPerProvider}
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
          {s.queueWaitMs}
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
          <p className="subtle">{s.mediaApis}</p>
          <h2>{s.mediaRouting}</h2>
        </div>
        <Sparkles size={18} />
      </div>
      <p className="compact-copy">{s.mediaBody}</p>
      <div className="settings-grid">
        <MediaProviderSelect
          label={s.images}
          autoLabel={s.autoRouting}
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
          label={s.speech}
          autoLabel={s.autoRouting}
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
          label={s.transcriptions}
          autoLabel={s.autoRouting}
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
          label={s.embeddings}
          autoLabel={s.autoRouting}
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
          <span className="label-with-icon"><Search size={15} /> {s.webSearch}</span>
          <input readOnly value={s.webSearchBuiltin} />
        </label>
      </div>
      <label>
        {s.caveman}
        <select
          value={routerDraft.tokenSaver?.caveman ?? "off"}
          onChange={(event) => setRouterDraft({ ...routerDraft, tokenSaver: { ...routerDraft.tokenSaver!, caveman: event.target.value as SaverLevel } })}
        >
          {saverLevels.map((level) => <option key={level} value={level}>{level}</option>)}
        </select>
      </label>
      <label>
        {s.ponytail}
        <select
          value={routerDraft.tokenSaver?.ponytail ?? "off"}
          onChange={(event) => setRouterDraft({ ...routerDraft, tokenSaver: { ...routerDraft.tokenSaver!, ponytail: event.target.value as SaverLevel } })}
        >
          {saverLevels.map((level) => <option key={level} value={level}>{level}</option>)}
        </select>
      </label>
      <button className="button primary" type="button" onClick={save}>
        <Save size={16} />
        {saved ? t.common.saved : t.common.save}
      </button>
      {error ? <p className="test-message error">{error}</p> : null}
    </section>
  );
}

function MediaProviderSelect({
  label,
  autoLabel,
  icon,
  value,
  providers,
  onChange
}: {
  label: string;
  autoLabel: string;
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
        <option value="">{autoLabel}</option>
        {openAiProviders.map((provider) => (
          <option value={provider.id} key={provider.id}>
            {provider.name} ({provider.status})
          </option>
        ))}
      </select>
    </label>
  );
}
