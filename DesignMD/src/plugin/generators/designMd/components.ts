import type { DesignSystem } from '@shared/types';
import { joinSections, mdHeading, mdTable } from '../markdown';
import { assignComponentDocPaths } from '../componentMd';

function componentsByPageSection(ds: DesignSystem): string {
  const countsByPage = new Map<string, number>();
  for (const c of ds.components) {
    const count = c.isComponentSet ? c.variants.length : 1;
    countsByPage.set(c.pageName, (countsByPage.get(c.pageName) ?? 0) + count);
  }
  const rows = Array.from(countsByPage.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([page, count]) => [page, String(count)]);

  return joinSections([
    mdHeading(3, 'Components by Page'),
    'Full document scan, including any draft, playground, or example pages — not just pages ' +
      "intended for publishing. Compare against Figma's own library/publish count if this " +
      'total looks higher than expected.\n',
    mdTable(['Page', 'Component Count'], rows),
  ]);
}

function markdownLinkTarget(path: string): string {
  return encodeURI(path).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

export function componentsSection(ds: DesignSystem): string {
  if (ds.components.length === 0) {
    return joinSections([
      mdHeading(2, 'Components'),
      '_No components or component sets found in this file._\n',
    ]);
  }
  const docPaths = assignComponentDocPaths(ds.components);
  const rows = ds.components.map((c) => [
    c.name,
    c.isComponentSet ? 'Component Set' : 'Component',
    c.pageName,
    String(c.variants.length),
    c.states.join(', ') || '—',
    c.sizes.join(', ') || '—',
    `[${docPaths.get(c.id)?.replace(/^components\//, '')}](./${markdownLinkTarget(docPaths.get(c.id) ?? '')})`,
  ]);
  return joinSections([
    mdHeading(2, 'Components'),
    'Full per-component documentation lives in `/components`. See individual files for variants, properties, and token references.\n',
    componentsByPageSection(ds),
    mdHeading(3, 'All Components'),
    mdTable(['Component', 'Type', 'Page', 'Variants', 'States', 'Sizes', 'Docs'], rows),
  ]);
}
