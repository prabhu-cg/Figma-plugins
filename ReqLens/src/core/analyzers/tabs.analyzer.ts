import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { hasDescendant, nameMatches } from '@core/utils/node-utils';
import { findRepeatingGroups } from '@core/utils/structural';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

// Word-boundary pattern: deliberately does not match inside "table".
const NAME_PATTERN = /\btabs?\b/;
const CANDIDATE_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP']);

export const tabsAnalyzer: Analyzer = {
  category: 'tabs',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const claimed = new Set<string>();
    const detectedParents = new Set<string>();

    function visit(node: AnalyzableNode): void {
      if (claimed.has(node.id)) return;

      if (CANDIDATE_TYPES.has(node.type) && nameMatches(node, [NAME_PATTERN])) {
        detectedParents.add(node.id);
        detections.push(
          makeDetection('tabs', node, ctx, {
            confidence: 0.7,
            evidence: [`Layer name matches tabs naming convention ("${node.name}")`],
            metadata: { tabCount: (node.children ?? []).length },
          }),
        );
        for (const child of node.children ?? []) claimed.add(child.id);
        return;
      }

      for (const child of node.children ?? []) visit(child);
    }
    visit(root);

    // Structural fallback: a row of 2-8 similarly sized, short, text-bearing items whose container hints at tabs.
    const groups = findRepeatingGroups(root, 2);
    for (const group of groups) {
      if (detectedParents.has(group.parent.id) || claimed.has(group.parent.id)) continue;
      const withinTabCount = group.items.length >= 2 && group.items.length <= 8;
      const allHaveText = group.items.every((item) => hasDescendant(item, (n) => n.type === 'TEXT'));
      const parentHintsTabs = /tabs?/.test(group.parent.name.toLowerCase());
      if (withinTabCount && allHaveText && parentHintsTabs) {
        detections.push(
          makeDetection('tabs', group.parent, ctx, {
            confidence: 0.45,
            evidence: [`${group.items.length} repeated tab-item-like children detected under "${group.parent.name}"`],
            metadata: { tabCount: group.items.length },
          }),
        );
      }
    }

    return detections;
  },
};
