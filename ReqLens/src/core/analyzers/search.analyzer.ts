import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { collectAllText, extractLabel, hasDescendant, nameMatches } from '@core/utils/node-utils';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\bsearch\b/;
const ICON_PATTERN = /\b(search|magnif(y|ier)|loupe)\b/;
const CANDIDATE_TYPES = new Set(['COMPONENT', 'INSTANCE', 'FRAME', 'GROUP']);

export const searchAnalyzer: Analyzer = {
  category: 'search',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const claimed = new Set<string>();

    function visit(node: AnalyzableNode): void {
      if (claimed.has(node.id)) return;

      if (CANDIDATE_TYPES.has(node.type)) {
        const nameHit = nameMatches(node, [NAME_PATTERN]);
        const hasSearchIcon = hasDescendant(node, (n) => n.type !== 'TEXT' && nameMatches(n, [ICON_PATTERN]));
        const placeholderHit = collectAllText(node).includes('search');

        if (nameHit || hasSearchIcon || (node.type === 'INSTANCE' && placeholderHit)) {
          const evidence: string[] = [];
          if (nameHit) evidence.push(`Layer name matches search naming convention ("${node.name}")`);
          if (hasSearchIcon) evidence.push('Contains a search/magnifier icon');
          if (placeholderHit) evidence.push('Placeholder or label text references "search"');

          const confidence = (nameHit ? 0.55 : 0.25) + (hasSearchIcon ? 0.25 : 0) + (placeholderHit ? 0.15 : 0);

          detections.push(
            makeDetection('search', node, ctx, {
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
