"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { LOCALE_LIST } from "@/i18n/catalog";
import { useI18n } from "@/components/I18nProvider";
import type { LocaleCode } from "@/i18n/types";

export default function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = LOCALE_LIST.find((item) => item.code === locale) ?? LOCALE_LIST[0]!;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="language-select" ref={rootRef}>
      <Languages size={16} aria-hidden="true" />
      <button
        type="button"
        className="language-select-trigger"
        aria-label={t.language}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={t.language}
        onClick={() => setOpen((value) => !value)}
      >
        {current.nativeLabel}
      </button>
      {open ? (
        <ul className="language-menu" id={listId} role="listbox" aria-label={t.language}>
          {LOCALE_LIST.map((item) => (
            <li key={item.code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={item.code === locale}
                className={item.code === locale ? "is-selected" : undefined}
                onClick={() => {
                  setLocale(item.code as LocaleCode);
                  setOpen(false);
                }}
              >
                {item.nativeLabel}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
