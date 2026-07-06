import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { hasDescendant, nameMatches } from '@core/utils/node-utils';
import { findRepeatingGroups } from '@core/utils/structural';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\b(accordion|collapsible|disclosure|expander)\b/;
const CHEVRON_PATTERN = /\b(chevron|caret|expand|collapse)\b/;
const CANDIDATE_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP']);

export const accordionAnalyzer: Analyzer = {
  category: 'accordion',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const claimed = new Set<string>();
    const detectedParents = new Set<string>();

    function visit(node: AnalyzableNode): void {
      if (claimed.has(node.id)) return;

      if (CANDIDATE_TYPES.has(node.type) && nameMatches(node, [NAME_PATTERN])) {
        detectedParents.add(node.id);
        detections.push(
          makeDetection('accordion', node, ctx, {
            confidence: 0.7,
            evidence: [`Layer name matches accordion naming convention ("${node.name}")`],
            metadata: { sectionCount: (node.children ?? []).length },
          }),
        );
        for (const child of node.children ?? []) claimed.add(child.id);
        return;
      }

      for (const child of node.children ?? []) visit(child);
    }
    visit(root);

    // Structural fallback: repeated rows that each pair a text label with a chevron/expand icon.
    const groups = findRepeatingGroups(root, 2);
    for (const group of groups) {
      if (detectedParents.has(group.parent.id) || claimed.has(group.parent.id)) continue;
      const allHaveChevronAndText = group.items.every(
        (item) =>
          hasDescendant(item, (n) => n.type === 'TEXT') &&
          hasDescendant(item, (n) => n.type !== 'TEXT' && nameMatches(n, [CHEVRON_PATTERN])),
      );
      if (allHaveChevronAndText) {
        detections.push(
          makeDetection('accordion', group.parent, ctx, {
            confidence: 0.5,
            evidence: [
              `${group.items.length} repeated rows pairing a label with an expand/chevron icon detected under "${group.parent.name}"`,
            ],
            metadata: { sectionCount: group.items.length },
          }),
        );
      }
    }

    return detections;
  },
};
