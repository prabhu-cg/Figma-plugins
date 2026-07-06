import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { extractLabel, nameMatches } from '@core/utils/node-utils';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\b(chart|graph|plot|sparkline|histogram)\b/;
const TYPE_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bbar ?chart\b/, 'bar'],
  [/\bline ?chart\b/, 'line'],
  [/\bpie ?chart\b/, 'pie'],
  [/\bdonut ?chart\b/, 'donut'],
  [/\barea ?chart\b/, 'area'],
  [/\bsparkline\b/, 'sparkline'],
  [/\bhistogram\b/, 'histogram'],
];
const CANDIDATE_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP', 'VECTOR']);

export const chartAnalyzer: Analyzer = {
  category: 'chart',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const claimed = new Set<string>();

    function visit(node: AnalyzableNode): void {
      if (claimed.has(node.id)) return;

      if (CANDIDATE_TYPES.has(node.type) && nameMatches(node, [NAME_PATTERN])) {
        const normalized = node.name.toLowerCase();
        const matchedType = TYPE_PATTERNS.find(([pattern]) => pattern.test(normalized));

        detections.push(
          makeDetection('chart', node, ctx, {
            confidence: matchedType ? 0.75 : 0.55,
            evidence: [`Layer name matches chart naming convention ("${node.name}")`],
            variant: matchedType?.[1] ?? 'unspecified',
            label: extractLabel(node),
          }),
        );
        for (const child of node.children ?? []) claimed.add(child.id);
        return;
      }

      for (const child of node.children ?? []) visit(child);
    }

    visit(root);
    return detections;
  },
};
