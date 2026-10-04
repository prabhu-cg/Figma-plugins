import type { DesignSystem } from '@shared/types';
import { joinSections, mdHeading, mdTable } from '../markdown';

function formatUsedBy(names: string[], max = 5): string {
  if (names.length === 0) return '—';
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')}, +${names.length - max} more`;
}

export function tokenUsageSection(ds: DesignSystem): string {
  if (ds.variables.length === 0) {
    return joinSections([
      mdHeading(2, 'Token Usage'),
      '_No variables to cross-reference against components._\n',
    ]);
  }

  const used = ds.variables.filter((v) => v.usedByComponents.length > 0);
  const unused = ds.variables.filter((v) => v.usedByComponents.length === 0);
  const percent = Math.round((used.length / ds.variables.length) * 100);

  const usedRows = [...used]
    .sort((a, b) => b.usedByComponents.length - a.usedByComponents.length)
    .map((v) => [
      v.name,
      v.cssName,
      String(v.usedByComponents.length),
      formatUsedBy(v.usedByComponents),
    ]);

  const unusedTable =
    unused.length === 0
      ? '_Every variable is referenced by at least one component._\n'
      : mdTable(
          ['Token', 'CSS Variable', 'Category', 'Collection'],
          unused.map((v) => [v.name, v.cssName, v.category, v.collectionName]),
        );

  return joinSections([
    mdHeading(2, 'Token Usage'),
    `${used.length} of ${ds.variables.length} variables (${percent}%) are referenced by at least one ` +
      "component in this file. Usage is derived from bound variables detected in each component's node " +
      'tree, including variables bound inside the text, color, and effect styles those components apply. ' +
      'Very large components are scanned only up to a layer/depth budget, so usage can be under-reported for them.\n',
    mdHeading(3, 'Referenced Variables'),
    mdTable(['Token', 'CSS Variable', 'Used By', 'Components'], usedRows),
    mdHeading(3, 'Unused Variables'),
    unusedTable,
  ]);
}
