import { useState } from "react";

/** Copies text to the clipboard and exposes a short-lived status line for the UI to show. */
export function useCopyStatus(): [status: string | undefined, copy: (text: string) => Promise<void>] {
  const [status, setStatus] = useState<string | undefined>(undefined);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied to clipboard");
    } catch {
      setStatus("Could not copy — select and copy manually");
    }
    setTimeout(() => setStatus(undefined), 3000);
  }

  return [status, copy];
}
