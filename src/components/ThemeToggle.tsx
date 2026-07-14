"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("nesa-theme") as Theme | null) ?? "dark";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("nesa-theme", next);
    document.documentElement.dataset.theme = next;
  }

  const label = theme === "dark" ? t.shell.light : t.shell.dark;
  const aria = theme === "dark" ? t.shell.switchToLight : t.shell.switchToDark;

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={aria}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      <span>{label}</span>
    </button>
  );
}
