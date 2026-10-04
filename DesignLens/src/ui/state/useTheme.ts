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
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    // "Match Figma": figma.showUI({ themeColors: true }) puts figma-light / figma-dark on <html>
    // and updates it when the user switches Figma's theme. That's the real signal; the OS
    // color scheme is only a fallback (e.g. opening the built page outside Figma).
    const systemIsDark = () =>
      root.classList.contains("figma-dark") ? true : root.classList.contains("figma-light") ? false : media.matches;
    const apply = () => root.setAttribute("data-theme", theme === "system" ? (systemIsDark() ? "dark" : "light") : theme);
    apply();
    writeStoredTheme(theme);
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      media.removeEventListener("change", apply);
      observer.disconnect();
    };
  }, [theme]);

  return { theme, setTheme };
}
