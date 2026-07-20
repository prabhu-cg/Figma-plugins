import type { ComponentDoc } from '@shared/types';

interface PageFilterProps {
  components: ComponentDoc[];
  excludedPages: ReadonlySet<string>;
  onChange: (excludedPages: Set<string>) => void;
}

interface PageCount {
  name: string;
  count: number;
}

function countByPage(components: ComponentDoc[]): PageCount[] {
  const counts = new Map<string, number>();
  for (const c of components) {
    const n = c.isComponentSet ? c.variants.length : 1;
    counts.set(c.pageName, (counts.get(c.pageName) ?? 0) + n);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function PageFilter({ components, excludedPages, onChange }: PageFilterProps) {
  const pages = countByPage(components);
  if (pages.length < 2) return null;

  const toggle = (name: string) => {
    const next = new Set(excludedPages);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next);
  };

  const totalCount = pages.reduce((sum, p) => sum + p.count, 0);
  const includedCount = pages
    .filter((p) => !excludedPages.has(p.name))
    .reduce((sum, p) => sum + p.count, 0);

  return (
    <section className="dmd-section">
      <h2 className="dmd-section-title">Include pages</h2>
      <p className="dmd-section-subtitle">
        {includedCount} of {totalCount} components selected — uncheck draft, example, or
        playground pages you don&apos;t want documented.
      </p>
      <div className="dmd-page-list">
        {pages.map((p) => (
          <label className="dmd-page-row" key={p.name}>
            <input
              type="checkbox"
              className="dmd-page-checkbox"
              checked={!excludedPages.has(p.name)}
              onChange={() => toggle(p.name)}
            />
            <span className="dmd-page-name">{p.name}</span>
            <span className="dmd-page-count">{p.count}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
