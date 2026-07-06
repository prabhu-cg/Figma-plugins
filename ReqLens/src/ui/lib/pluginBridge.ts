import { toPluginMessageEnvelope } from '@shared/messages';
import type { MainToUIMessage, UIToMainMessage } from '@shared/messages';

/** Sends a typed message from the UI iframe to the plugin's main thread. */
export function sendToMain(message: UIToMainMessage): void {
  window.parent.postMessage(toPluginMessageEnvelope(message), '*');
}

/** Subscribes to typed messages from the plugin's main thread; returns an unsubscribe function. */
export function onMainMessage(handler: (message: MainToUIMessage) => void): () => void {
  const listener = (event: MessageEvent): void => {
    const message = (event.data as { pluginMessage?: MainToUIMessage } | undefined)?.pluginMessage;
    if (message) handler(message);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
