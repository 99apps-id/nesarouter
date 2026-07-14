"use client";

import { useI18n } from "@/components/I18nProvider";

export default function EndpointBox({ endpointBase }: { endpointBase: string }) {
  const { t } = useI18n();
  return (
    <div className="endpoint-box">
      <span>{t.common.endpoint}</span>
      <code>{endpointBase}</code>
      <small>{t.nav.endpointHint}</small>
    </div>
  );
}
