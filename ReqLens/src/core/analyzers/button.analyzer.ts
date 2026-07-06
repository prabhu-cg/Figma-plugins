import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { ButtonVariant, DetectedComponent } from '@core/types/analysis.types';
import { extractLabel, nameMatches, normalizeName } from '@core/utils/node-utils';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\b(button|btn|cta)\b/;
const CANDIDATE_TYPES = new Set(['COMPONENT', 'INSTANCE', 'FRAME', 'GROUP']);

function detectVariant(node: AnalyzableNode): ButtonVariant {
  const name = normalizeName(`${node.name} ${node.mainComponentName ?? ''}`);
  if (/\b(tertiary|ghost|link|text ?only)\b/.test(name)) return 'tertiary';
  if (/\b(secondary|outline|outlined|stroke)\b/.test(name)) return 'secondary';
  if (/\b(primary|filled|solid)\b/.test(name)) return 'primary';
  return 'unknown';
}

function looksButtonShaped(node: AnalyzableNode): boolean {
  if (node.width <= 0 || node.height <= 0) return false;
  return node.height >= 20 && node.height <= 72 && node.width >= 32 && node.width <= 480 && node.width >= node.height;
}

export const buttonAnalyzer: Analyzer = {
  category: 'button',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const claimed = new Set<string>();

    function visit(node: AnalyzableNode): void {
      if (claimed.has(node.id)) return;

      if (CANDIDATE_TYPES.has(node.type)) {
        const nameHit = nameMatches(node, [NAME_PATTERN]) || nameMatches({ ...node, name: node.mainComponentName ?? '' }, [NAME_PATTERN]);
        const shapeHit = looksButtonShaped(node);

        if (nameHit || (node.type === 'INSTANCE' && shapeHit)) {
          const variant = detectVariant(node);
          const evidence: string[] = [];
          if (nameHit) evidence.push(`Layer name matches button naming convention ("${node.name}")`);
          if (shapeHit) evidence.push('Dimensions are consistent with a clickable button');
          if (node.type === 'INSTANCE') evidence.push('Node is a component instance, suggesting a reusable button component');
          if (variant !== 'unknown') evidence.push(`Variant keyword detected: "${variant}"`);

          const confidence = (nameHit ? 0.55 : 0.3) + (shapeHit ? 0.2 : 0) + (variant !== 'unknown' ? 0.15 : 0) + (node.type === 'INSTANCE' ? 0.1 : 0);

          detections.push(
            makeDetection('button', node, ctx, {
              confidence,
              evidence,
              variant,
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
