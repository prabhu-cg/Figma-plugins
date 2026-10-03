import { postToUi } from "@plugin/utils/postMessage";
import type { Msg } from "./types";

export async function handleFocusNode(message: Msg<"focus-node">): Promise<void> {
  try {
    const node = await figma.getNodeByIdAsync(message.nodeId);
    if (node && "type" in node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
      const sceneNode = node as SceneNode;
      const page = sceneNode.parent
        ? (function findPage(n: BaseNode | null): PageNode | undefined {
            let current = n;
            while (current) {
              if (current.type === "PAGE") return current as PageNode;
              current = current.parent;
            }
            return undefined;
          })(sceneNode)
        : undefined;
      if (page) {
        await figma.setCurrentPageAsync(page);
      }
      figma.currentPage.selection = [sceneNode];
      figma.viewport.scrollAndZoomIntoView([sceneNode]);
    }
  } catch {
    postToUi({ type: "error", message: "Could not locate that node — it may have been deleted." });
  }
}
