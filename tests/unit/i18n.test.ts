import { describe, expect, it } from "vitest";
import { getMessages, isLocaleCode, LOCALE_LIST } from "@/i18n/catalog";
import { en } from "@/i18n/types";

describe("i18n catalog", () => {
  it("exposes 20 locales including id/ms/zh/ja/ru/ar", () => {
    expect(LOCALE_LIST).toHaveLength(20);
    for (const code of ["en", "id", "ms", "zh-CN", "zh-TW", "ja", "ko", "ar", "ru"] as const) {
      expect(isLocaleCode(code)).toBe(true);
    }
    expect(LOCALE_LIST.find((item) => item.code === "ar")?.dir).toBe("rtl");
  });

  it("falls back missing keys to English", () => {
    const id = getMessages("id");
    expect(id.cli.applyPatch).toBeTruthy();
    expect(id.nav.cli).toBeTruthy();
    expect(Object.keys(id.cli).sort()).toEqual(Object.keys(en.cli).sort());
  });

  it("keeps English as the canonical default CLI wording", () => {
    expect(en.cli.heroTitle).toContain("Apply / Patch");
    expect(en.cli.heroBody).not.toMatch(/Hubungkan|mesin ini|Tidak perlu/);
  });

  it("translates UI chrome for every non-English locale", () => {
    for (const { code } of LOCALE_LIST) {
      const messages = getMessages(code);
      expect(messages.shell.dashboard.trim().length).toBeGreaterThan(0);
      expect(messages.settings.dailyBudget.trim().length).toBeGreaterThan(0);
      expect(messages.overview.spendToday.trim().length).toBeGreaterThan(0);
      expect(messages.password.title.trim().length).toBeGreaterThan(0);
      expect(messages.aliases.title.trim().length).toBeGreaterThan(0);
    }
    expect(getMessages("ja").shell.dashboard).not.toBe(en.shell.dashboard);
    expect(getMessages("es").settings.dailyBudget).not.toBe(en.settings.dailyBudget);
    expect(getMessages("ar").shell.brandTagline).not.toBe(en.shell.brandTagline);
    expect(getMessages("id").shell.dashboard).toBe("Dasbor");
  });
});
