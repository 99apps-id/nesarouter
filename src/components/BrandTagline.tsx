"use client";

import { useI18n } from "@/components/I18nProvider";

export default function BrandTagline({ version }: { version: string }) {
  const { t } = useI18n();
  return (
    <span>
      {t.shell.brandTagline} · v{version}
    </span>
  );
}
