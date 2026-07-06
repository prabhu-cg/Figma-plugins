import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { hasDescendant, nameMatches } from '@core/utils/node-utils';
import { averageAspectRatio, findRepeatingGroups } from '@core/utils/structural';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\bcard\b/;
const IMAGE_LIKE_TYPES = new Set(['RECTANGLE', 'ELLIPSE', 'VECTOR']);

export const cardAnalyzer: Analyzer = {
  category: 'card',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const detectedParents = new Set<string>();

    function visitNamed(node: AnalyzableNode): void {
      if (nameMatches(node, [NAME_PATTERN]) && node.type !== 'TEXT') {
        detectedParents.add(node.id);
        detections.push(
          makeDetection('card', node, ctx, {
            confidence: 0.65,
            evidence: [`Layer name matches card naming convention ("${node.name}")`],
          }),
        );
        return;
      }
      for (const child of node.children ?? []) visitNamed(child);
    }
    visitNamed(root);

    // Structural: a tile grid — repeated, roughly square-to-tall items each with an image-like child + text.
    const groups = findRepeatingGroups(root, 2);
    for (const group of groups) {
      if (detectedParents.has(group.parent.id)) continue;
      const aspect = averageAspectRatio(group.items);
      const hasImageAndText = group.items.every(
        (item) => hasDescendant(item, (n) => IMAGE_LIKE_TYPES.has(n.type)) && hasDescendant(item, (n) => n.type === 'TEXT'),
      );
      const looksLikeCards = aspect < 2 && hasImageAndText;
      if (looksLikeCards) {
        detectedParents.add(group.parent.id);
        detections.push(
          makeDetection('card', group.parent, ctx, {
            confidence: 0.5,
            evidence: [
              `${group.items.length} structurally identical tiles with media + text detected under "${group.parent.name}"`,
            ],
            metadata: { cardCount: group.items.length },
          }),
        );
      }
    }

    return detections;
  },
};
