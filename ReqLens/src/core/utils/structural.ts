import type { AnalyzableNode } from '@core/types/figma-node.types';
import { directChildren } from './node-utils';

/** Shape fingerprint ignoring text/ids — same fingerprint means "structurally identical sibling". */
function shapeSignature(node: AnalyzableNode): string {
  const childTypes = directChildren(node)
    .map((c) => c.type)
    .join(',');
  return `${node.type}:${directChildren(node).length}:${childTypes}`;
}

export interface RepeatingGroup {
  parent: AnalyzableNode;
  items: AnalyzableNode[];
}

/**
 * Finds runs of >= minRepeats direct-child siblings that share a structural
 * signature. This is the generic fingerprint behind table rows, repeated
 * cards, list items, nav items, and accordion rows — real screens build all
 * of these as "N structurally identical containers under one parent".
 */
export function findRepeatingGroups(root: AnalyzableNode, minRepeats = 3): RepeatingGroup[] {
  const groups: RepeatingGroup[] = [];

  function visit(node: AnalyzableNode): void {
    const children = directChildren(node);
    if (children.length >= minRepeats) {
      const bySignature = new Map<string, AnalyzableNode[]>();
      for (const child of children) {
        if (child.type === 'TEXT') continue;
        const sig = shapeSignature(child);
        const list = bySignature.get(sig) ?? [];
        list.push(child);
        bySignature.set(sig, list);
      }
      for (const items of bySignature.values()) {
        if (items.length >= minRepeats) groups.push({ parent: node, items });
      }
    }
    for (const child of children) visit(child);
  }

  visit(root);
  return groups;
}

/** Average width/height ratio across a group's items — >1 favors "wide row", <1 favors "tall tile". */
export function averageAspectRatio(items: readonly AnalyzableNode[]): number {
  if (items.length === 0) return 1;
  const ratios = items.map((item) => (item.height > 0 ? item.width / item.height : 1));
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}
