import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
const STORAGE_KEY = "dslog-theme";

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Some Figma plugin UI embeddings restrict localStorage access — fall back silently.
    return "system";
  }
}

function writeStoredTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Non-fatal: theme just won't persist across sessions in this environment.
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * `data-theme` is always set explicitly (never removed for "system"), so the stylesheet
 * needs a single dark block. index.html runs the same resolution before first paint.
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.setAttribute("data-theme", theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme);
    apply();
    writeStoredTheme(theme);

    if (theme !== "system" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [theme]);

  return { theme, setTheme };
}
