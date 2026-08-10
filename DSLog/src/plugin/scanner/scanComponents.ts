import type { ComponentSnapshot } from "@shared/types/component";
import { SCAN_BATCH_SIZE } from "@shared/constants/storage";
import { normalizeComponent } from "@plugin/snapshot/normalizeComponent";
import { adaptNode } from "./adaptNode";
import type { ComponentInputLike, ComponentVariantLike } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ComponentScanResult {
  components: ComponentSnapshot[];
  scanned: number;
  skipped: Array<{ id: string; name: string; reason: string }>;
}

function buildInputFromComponent(node: any): ComponentInputLike {
  const parentSet = node.parent && node.parent.type === "COMPONENT_SET" ? node.parent : undefined;
  return {
    id: node.id,
    key: node.key,
    name: node.name,
    type: "COMPONENT",
    description: node.description || undefined,
    documentationLinks: node.documentationLinks,
    remote: Boolean(node.remote),
    componentSetId: parentSet?.id,
    componentSetName: parentSet?.name,
    componentPropertyDefinitions: (parentSet ?? node).componentPropertyDefinitions,
    variants: [
      {
        id: node.id,
        name: node.name,
        variantProperties: node.variantProperties ?? undefined,
        node: adaptNode(node),
      },
    ],
    representative: adaptNode(node),
  };
}

function buildInputFromComponentSet(node: any): ComponentInputLike {
  const variantNodes: any[] = node.children ?? [];
  const variants: ComponentVariantLike[] = variantNodes.map((child) => ({
    id: child.id,
    name: child.name,
    variantProperties: child.variantProperties ?? undefined,
    node: adaptNode(child),
  }));
  const representative = variantNodes[0] ? adaptNode(variantNodes[0]) : adaptNode(node);

  return {
    id: node.id,
    key: node.key,
    name: node.name,
    type: "COMPONENT_SET",
    description: node.description || undefined,
    documentationLinks: node.documentationLinks,
    remote: Boolean(node.remote),
    componentPropertyDefinitions: node.componentPropertyDefinitions,
    variants,
    representative,
  };
}

export async function scanComponents(
  componentIds: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ComponentScanResult> {
  const components: ComponentSnapshot[] = [];
  const skipped: Array<{ id: string; name: string; reason: string }> = [];

  for (let i = 0; i < componentIds.length; i += SCAN_BATCH_SIZE) {
    const batch = componentIds.slice(i, i + SCAN_BATCH_SIZE);
    await Promise.all(
      batch.map(async (id) => {
        try {
          const node = await figma.getNodeByIdAsync(id);
          if (!node) {
            skipped.push({ id, name: id, reason: "Node not found (deleted or moved out of scope)" });
            return;
          }
          if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
            skipped.push({ id, name: node.name, reason: `Unsupported node type ${node.type}` });
            return;
          }
          const input =
            node.type === "COMPONENT_SET" ? buildInputFromComponentSet(node) : buildInputFromComponent(node);
          components.push(normalizeComponent(input));
        } catch (error) {
          skipped.push({ id, name: id, reason: error instanceof Error ? error.message : "Unknown scan error" });
        }
      }),
    );
    onProgress?.(Math.min(i + SCAN_BATCH_SIZE, componentIds.length), componentIds.length);
  }

  return { components, scanned: components.length, skipped };
}
