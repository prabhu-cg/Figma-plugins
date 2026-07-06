import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { extractLabel, hasDescendant, nameMatches } from '@core/utils/node-utils';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\b(input|text ?field|textfield|text ?box|form ?field)\b/;
const CANDIDATE_TYPES = new Set(['COMPONENT', 'INSTANCE', 'FRAME', 'GROUP']);

function looksInputShaped(node: AnalyzableNode): boolean {
  if (node.width <= 0 || node.height <= 0) return false;
  return node.height >= 28 && node.height <= 64 && node.width >= 80 && node.width / node.height >= 2;
}

export const inputAnalyzer: Analyzer = {
  category: 'input',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const claimed = new Set<string>();

    function visit(node: AnalyzableNode): void {
      if (claimed.has(node.id)) return;

      if (CANDIDATE_TYPES.has(node.type)) {
        const nameHit = nameMatches(node, [NAME_PATTERN]);
        const shapeHit = looksInputShaped(node);
        const hasSingleTextChild = hasDescendant(node, (n) => n.type === 'TEXT');

        if (nameHit || (shapeHit && hasSingleTextChild && node.type === 'INSTANCE')) {
          const evidence: string[] = [];
          if (nameHit) evidence.push(`Layer name matches input field naming convention ("${node.name}")`);
          if (shapeHit) evidence.push('Wide, short shape consistent with a single-line text field');
          if (hasSingleTextChild) evidence.push('Contains placeholder/label text');

          const confidence = (nameHit ? 0.55 : 0.3) + (shapeHit ? 0.2 : 0) + (hasSingleTextChild ? 0.15 : 0);

          detections.push(
            makeDetection('input', node, ctx, {
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
