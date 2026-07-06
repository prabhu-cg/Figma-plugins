import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { extractLabel, hasDescendant, nameMatches } from '@core/utils/node-utils';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\b(modal|dialog|popup|pop-up|overlay|lightbox)\b/;
const CLOSE_ICON_PATTERN = /\b(close|dismiss|x)\b/;
const CANDIDATE_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP']);

export const modalAnalyzer: Analyzer = {
  category: 'modal',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const claimed = new Set<string>();

    function visit(node: AnalyzableNode): void {
      if (claimed.has(node.id)) return;

      if (CANDIDATE_TYPES.has(node.type)) {
        const nameHit = nameMatches(node, [NAME_PATTERN]);
        const hasCloseIcon = hasDescendant(node, (n) => n.type !== 'TEXT' && nameMatches(n, [CLOSE_ICON_PATTERN]));

        if (nameHit) {
          const evidence: string[] = [`Layer name matches modal/dialog naming convention ("${node.name}")`];
          if (hasCloseIcon) evidence.push('Contains a close/dismiss control');

          detections.push(
            makeDetection('modal', node, ctx, {
              confidence: 0.6 + (hasCloseIcon ? 0.25 : 0),
              evidence,
              label: extractLabel(node),
            }),
          );
          for (const child of node.children ?? []) claimed.add(child.id);
          return;
        }
      }

      for (const child of node.children ?? []) visit(child);
    }

    visit(root);
    return detections;
  },
};
