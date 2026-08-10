import type { PluginToUiMessage } from "@shared/types/messages";

export function postToUi(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}
