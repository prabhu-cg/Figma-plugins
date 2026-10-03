import { useState } from "react";

const PREFIX = "dslog-dismissed:";

/**
 * Remembers that the user has dismissed a piece of one-time guidance (an explainer banner).
 * localStorage can be blocked inside Figma's plugin iframe, so a failure just means the
 * banner comes back next session — it still dismisses for the current one.
 */
export function useDismissOnce(key: string): [dismissed: boolean, dismiss: () => void] {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(PREFIX + key) === "1";
    } catch {
      return false;
    }
  });

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(PREFIX + key, "1");
    } catch {
      // Non-fatal, see above.
    }
  }

  return [dismissed, dismiss];
}
