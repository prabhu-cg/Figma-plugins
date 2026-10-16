import type { UiToPluginMessage } from "@shared/types/messages";
import { handleMessage } from "@plugin/handlers";
import { postToUi } from "@plugin/utils/postMessage";
import { setSaveLogger } from "@plugin/storage";
import { flushScheduledPersist } from "@plugin/handlers/session";

figma.showUI(__html__, { width: 1180, height: 760, themeColors: true });

// One quiet line per save that wrote something, so slow saves on a big file are easy to spot (Figma ▸ Plugins ▸
// Development ▸ Open console). Reads and no-op saves stay silent.
setSaveLogger((stats) => {
  if (stats.partsWritten === 0) return;
  console.log(
    `[DSLog] saved ${stats.partsWritten} of ${stats.partsChecked} parts (${Math.round(stats.bytesWritten / 1024)} KB) in ${stats.ms} ms`,
  );
});

figma.ui.onmessage = (message: UiToPluginMessage) => {
  handleMessage(message).catch((error) => {
    // Figma's own messages can be as terse as "not a function"; the stack, in the console, says which call.
    console.error(`[DSLog] "${message.type}" failed:`, error instanceof Error && error.stack ? error.stack : error);
    postToUi({
      type: "error",
      message: error instanceof Error ? error.message : "Unexpected error in DSLog plugin.",
    });
  });
};

// Closing the plugin shouldn't throw away a review made in the last fraction of a second.
figma.on("close", flushScheduledPersist);
