import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { extractLabel, hasDescendant, nameMatches } from '@core/utils/node-utils';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\b(dropdown|drop ?down|select|combo ?box|picker)\b/;
const ICON_PATTERN = /\b(chevron|caret|arrow[- ]?down)\b/;
const CANDIDATE_TYPES = new Set(['COMPONENT', 'INSTANCE', 'FRAME', 'GROUP']);

export const dropdownAnalyzer: Analyzer = {
  category: 'dropdown',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const claimed = new Set<string>();

    function visit(node: AnalyzableNode): void {
      if (claimed.has(node.id)) return;

      if (CANDIDATE_TYPES.has(node.type)) {
        const nameHit = nameMatches(node, [NAME_PATTERN]);
        const hasChevron = hasDescendant(node, (n) => nameMatches(n, [ICON_PATTERN]));

        if (nameHit || (node.type === 'INSTANCE' && hasChevron)) {
          const evidence: string[] = [];
          if (nameHit) evidence.push(`Layer name matches dropdown/select naming convention ("${node.name}")`);
          if (hasChevron) evidence.push('Contains a chevron/caret icon indicating an expandable selector');

          const confidence = (nameHit ? 0.6 : 0.35) + (hasChevron ? 0.25 : 0);

          detections.push(
            makeDetection('dropdown', node, ctx, {
              confidence,
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
