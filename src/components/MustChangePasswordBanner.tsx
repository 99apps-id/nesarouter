"use client";

import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

export default function MustChangePasswordBanner() {
  const { t } = useI18n();
  return (
    <section className="alert-banner">
      <ShieldCheck size={18} />
      <div>
        <strong>{t.shell.changePasswordTitle}</strong>
        <span>{t.shell.changePasswordBody}</span>
      </div>
    </section>
  );
}
