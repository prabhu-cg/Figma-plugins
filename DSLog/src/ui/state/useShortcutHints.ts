import { useState } from "react";

const STORAGE_KEY = "dslog-shortcut-hints";

/**
 * Whether the keyboard-shortcut hints (key badges and the legend) are visible. Off by default — the shortcuts
 * work either way; this only controls the hints. localStorage can be blocked in Figma's plugin iframe, so a
 * failure just means the choice isn't remembered across sessions.
 */
export function useShortcutHints(): [shown: boolean, toggle: () => void] {
  const [shown, setShown] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  function toggle() {
    const next = !shown;
    setShown(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Non-fatal, see above.
    }
  }

  return [shown, toggle];
}
