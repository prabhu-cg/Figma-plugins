import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
const STORAGE_KEY = "designlens-theme";

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

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    writeStoredTheme(theme);
  }, [theme]);

  return { theme, setTheme };
}
