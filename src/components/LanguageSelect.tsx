"use client";

import { Languages } from "lucide-react";
import { LOCALE_LIST } from "@/i18n/catalog";
import { useI18n } from "@/components/I18nProvider";
import type { LocaleCode } from "@/i18n/types";

export default function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="language-select" title={t.language}>
      <Languages size={16} aria-hidden="true" />
      <span className="sr-only">{t.language}</span>
      <select
        aria-label={t.language}
        value={locale}
        onChange={(event) => setLocale(event.target.value as LocaleCode)}
      >
        {LOCALE_LIST.map((item) => (
          <option key={item.code} value={item.code}>
            {item.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
