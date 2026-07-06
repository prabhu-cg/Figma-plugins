import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { extractLabel, nameMatches } from '@core/utils/node-utils';
import { findRepeatingGroups } from '@core/utils/structural';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\b(navbar|nav ?bar|navigation|sidebar|side ?nav|top ?bar|header ?bar|menu ?bar|breadcrumbs?)\b/;
const CANDIDATE_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP']);

export const navigationAnalyzer: Analyzer = {
  category: 'navigation',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const claimed = new Set<string>();
    const detectedParents = new Set<string>();

    function visit(node: AnalyzableNode): void {
      if (claimed.has(node.id)) return;

      if (CANDIDATE_TYPES.has(node.type) && nameMatches(node, [NAME_PATTERN])) {
        detectedParents.add(node.id);
        const variant = /sidebar|side ?nav/.test(node.name.toLowerCase()) ? 'sidebar' : 'top-nav';
        detections.push(
          makeDetection('navigation', node, ctx, {
            confidence: 0.7,
            evidence: [`Layer name matches navigation naming convention ("${node.name}")`],
            variant,
            label: extractLabel(node),
          }),
        );
        for (const child of node.children ?? []) claimed.add(child.id);
        return;
      }

      for (const child of node.children ?? []) visit(child);
    }
    visit(root);

    // Structural fallback: 3+ repeated, roughly equal-sized nav-item-like children (icon/label pairs) in a row/column.
    const groups = findRepeatingGroups(root, 3);
    for (const group of groups) {
      if (detectedParents.has(group.parent.id) || claimed.has(group.parent.id)) continue;
      const looksLikeNavItems = group.items.every((item) => (item.children ?? []).length <= 3 && item.height <= 80);
      const parentNameHints = /menu|nav|tabs?/.test(group.parent.name.toLowerCase());
      if (looksLikeNavItems && parentNameHints) {
        detections.push(
          makeDetection('navigation', group.parent, ctx, {
            confidence: 0.4,
            evidence: [`${group.items.length} repeated nav-item-like children detected under "${group.parent.name}"`],
          }),
        );
      }
    }

    return detections;
  },
};
