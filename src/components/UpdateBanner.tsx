"use client";

import { useEffect, useState } from "react";
import { ArrowUpCircle, X } from "lucide-react";
import { formatMessage } from "@/i18n/types";
import { useI18n } from "@/components/I18nProvider";

interface UpdateInfo {
  enabled: boolean;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseName: string | null;
}

const DISMISS_KEY = "nesa_update_dismissed";

export default function UpdateBanner() {
  const { t } = useI18n();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/update").catch(() => null);
      if (!response?.ok || cancelled) return;
      const payload = (await response.json()) as UpdateInfo;
      if (cancelled || !payload.updateAvailable || !payload.latestVersion) return;
      try {
        if (sessionStorage.getItem(DISMISS_KEY) === payload.latestVersion) {
          setHidden(true);
        }
      } catch {
        /* ignore */
      }
      setInfo(payload);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info?.updateAvailable || !info.latestVersion || hidden) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, info!.latestVersion!);
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  return (
    <section className="alert-banner update-banner" role="status">
      <ArrowUpCircle size={18} />
      <div>
        <strong>{formatMessage(t.shell.updateAvailable, { version: info.latestVersion })}</strong>
        <span>
          {formatMessage(t.shell.youAreOn, { version: info.currentVersion })}{" "}
          {info.releaseUrl ? (
            <a href={info.releaseUrl} target="_blank" rel="noreferrer">
              {t.shell.viewReleaseNotes}
            </a>
          ) : (
            t.shell.checkGithub
          )}
        </span>
      </div>
      <button className="button" type="button" onClick={dismiss} aria-label={t.shell.dismissUpdate}>
        <X size={16} />
      </button>
    </section>
  );
}
