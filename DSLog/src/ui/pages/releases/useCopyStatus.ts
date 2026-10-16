import { useState } from "react";

/** Legacy copy path: Figma's plugin iframe can reject the async Clipboard API, but execCommand still works. */
function copyWithSelection(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return typeof document.execCommand === "function" && document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** Copies text to the clipboard and exposes a short-lived status line for the UI to show. */
export function useCopyStatus(): [status: string | undefined, copy: (text: string) => Promise<void>] {
  const [status, setStatus] = useState<string | undefined>(undefined);

  async function copy(text: string) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = copyWithSelection(text);
    }
    setStatus(copied ? "Copied to clipboard" : "Could not copy — select and copy manually");
    setTimeout(() => setStatus(undefined), 3000);
  }

  return [status, copy];
}
