"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

const STORAGE_KEY = "nesa-endpoint-visible";

export default function EndpointBox({ endpointBase }: { endpointBase: string }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "0") setVisible(false);
  }, []);

  function toggle() {
    const next = !visible;
    setVisible(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  return (
    <div className={`endpoint-box${visible ? "" : " is-collapsed"}`}>
      <div className="endpoint-box-header">
        <span>{t.common.endpoint}</span>
        <button
          type="button"
          className="icon-button endpoint-visibility"
          onClick={toggle}
          aria-expanded={visible}
          aria-label={visible ? t.nav.hideEndpoint : t.nav.showEndpoint}
          title={visible ? t.nav.hideEndpoint : t.nav.showEndpoint}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {visible ? (
        <>
          <code>{endpointBase}</code>
          <small>{t.nav.endpointHint}</small>
        </>
      ) : null}
    </div>
  );
}
