import type { UiToPluginMessage } from "@shared/types/messages";
import { handleMessage } from "@plugin/handlers";
import { postToUi } from "@plugin/utils/postMessage";

figma.showUI(__html__, { width: 1180, height: 760, themeColors: true });

figma.ui.onmessage = (message: UiToPluginMessage) => {
  handleMessage(message).catch((error) => {
    postToUi({
      type: "error",
      message: error instanceof Error ? error.message : "Unexpected error in DSLog plugin.",
    });
  });
};
