import type { DesignSystem } from '@shared/types';
import { computeStyleUsage, computeVariableUsage } from './usage';
import { buildSummary } from './summary';

/**
 * Drops components whose page is in `excludedPages` (e.g. draft/example/playground
 * pages a user opted out of), then recomputes everything derived from the component
 * list — variable usage and summary counts — so generated outputs stay consistent.
 * Variables, collections, and styles themselves are untouched (they aren't page-scoped in
 * Figma); only their usage is recomputed.
 */
export function filterDesignSystemByPages(
  ds: DesignSystem,
  excludedPages: ReadonlySet<string> | readonly string[],
): DesignSystem {
  const excluded = excludedPages instanceof Set ? excludedPages : new Set(excludedPages);
  if (excluded.size === 0) return ds;

  const components = ds.components.filter((c) => !excluded.has(c.pageName));
  if (components.length === ds.components.length) return ds;

  const variables = computeVariableUsage(ds.variables, components);
  const styles = computeStyleUsage(ds.styles, components);
  const base = { collections: ds.collections, variables, styles, components };

  return {
    ...ds,
    variables,
    styles,
    components,
    summary: buildSummary(base),
  };
}
