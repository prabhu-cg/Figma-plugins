import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { DetectedComponent } from '@core/types/analysis.types';
import { countNodes, nameMatches } from '@core/utils/node-utils';
import { averageAspectRatio, findRepeatingGroups } from '@core/utils/structural';
import { type Analyzer, type AnalyzerContext, makeDetection } from './base.analyzer';

const NAME_PATTERN = /\b(table|data ?grid|grid|list ?view)\b/;

export const tableAnalyzer: Analyzer = {
  category: 'table',

  detect(root, ctx: AnalyzerContext): DetectedComponent[] {
    const detections: DetectedComponent[] = [];
    const detectedParents = new Set<string>();

    // Path 1: explicit naming.
    function visitNamed(node: AnalyzableNode): void {
      if (nameMatches(node, [NAME_PATTERN]) && (node.type === 'FRAME' || node.type === 'INSTANCE' || node.type === 'COMPONENT')) {
        detectedParents.add(node.id);
        detections.push(
          makeDetection('table', node, ctx, {
            confidence: 0.7,
            evidence: [`Layer name matches table/grid naming convention ("${node.name}")`],
            metadata: { rowCount: (node.children ?? []).length },
          }),
        );
        return;
      }
      for (const child of node.children ?? []) visitNamed(child);
    }
    visitNamed(root);

    // Path 2: structural — a parent with >= 3 rows that are wide (row-shaped) and each contain >= 2 text-bearing columns.
    const groups = findRepeatingGroups(root, 3);
    for (const group of groups) {
      if (detectedParents.has(group.parent.id)) continue;
      const aspect = averageAspectRatio(group.items);
      const avgColumns = group.items.reduce((sum, item) => sum + Math.max(1, (item.children ?? []).length), 0) / group.items.length;
      const looksLikeRows = aspect >= 2 && avgColumns >= 2;
      if (looksLikeRows) {
        detectedParents.add(group.parent.id);
        detections.push(
          makeDetection('table', group.parent, ctx, {
            confidence: 0.55,
            evidence: [
              `${group.items.length} structurally identical wide rows detected under "${group.parent.name}"`,
              `Average ${avgColumns.toFixed(1)} columns per row`,
            ],
            metadata: { rowCount: group.items.length, totalNodes: countNodes(group.parent) },
          }),
        );
      }
    }

    return detections;
  },
};
