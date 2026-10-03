import type { PluginToUiMessage, UiToPluginMessage } from "@shared/types/messages";

/**
 * Stand-in for `@ui/state/bridge`. Every UI → plugin message is recorded in `sent` (and offered to
 * `onSend`, which the fake plugin uses to reply); `emit` delivers a plugin → UI message to every
 * subscriber. Wire it into a test file with:
 *
 *   vi.mock("@ui/state/bridge", async () => (await import("./helpers/bridge")).bridgeModule);
 */
type Handler = (message: PluginToUiMessage) => void;

const handlers = new Set<Handler>();

export const bridge = {
  sent: [] as UiToPluginMessage[],
  onSend: undefined as ((message: UiToPluginMessage) => void) | undefined,
  emit(message: PluginToUiMessage) {
    for (const handler of [...handlers]) handler(message);
  },
  reset() {
    bridge.sent = [];
    bridge.onSend = undefined;
    handlers.clear();
  },
  /** Messages of one type, in order. */
  sentOfType<T extends UiToPluginMessage["type"]>(type: T) {
    return bridge.sent.filter((m): m is Extract<UiToPluginMessage, { type: T }> => m.type === type);
  },
};

export const bridgeModule = {
  sendToPlugin(message: UiToPluginMessage) {
    bridge.sent.push(message);
    bridge.onSend?.(message);
  },
  onPluginMessage(handler: Handler) {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  },
};
