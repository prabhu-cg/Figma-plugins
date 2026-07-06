import { useEffect, useRef } from 'react';
import type { PluginToUIMessage, UIToPluginMessage } from '@shared/messages';

export function postToPlugin(message: UIToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

/** Subscribes to messages posted by the plugin's main.ts controller. */
export function usePluginMessages(onMessage: (message: PluginToUIMessage) => void): void {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const listener = (event: MessageEvent<{ pluginMessage?: PluginToUIMessage }>) => {
      const message = event.data?.pluginMessage;
      if (message) handlerRef.current(message);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
}
