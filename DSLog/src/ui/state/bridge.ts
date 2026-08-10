import type { PluginToUiMessage, UiToPluginMessage } from "@shared/types/messages";

export function sendToPlugin(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

export function onPluginMessage(handler: (message: PluginToUiMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    const message = event.data?.pluginMessage as PluginToUiMessage | undefined;
    if (message) handler(message);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
