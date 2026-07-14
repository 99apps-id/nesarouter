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
});
