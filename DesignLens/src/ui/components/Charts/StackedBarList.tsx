export interface StackedBarSegment {
  value: number;
  color: string;
}

export interface StackedBarItem {
  label: string;
  segments: StackedBarSegment[];
}

interface StackedBarListProps {
  items: StackedBarItem[];
  maxItems?: number;
}

function total(item: StackedBarItem): number {
  return item.segments.reduce((sum, s) => sum + s.value, 0);
}

/**
 * Like BarList, but each bar is split into colored segments (e.g. critical/warning/suggestion)
 * so relative severity mix is visible per row, not just the raw count — answers "which module
 * needs urgent attention" rather than just "which module has the most issues".
 */
export function StackedBarList({ items, maxItems }: StackedBarListProps) {
  const sorted = [...items].sort((a, b) => total(b) - total(a)).slice(0, maxItems);
  const max = Math.max(1, ...sorted.map(total));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map((item) => {
        const itemTotal = total(item);
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
              <span>{item.label}</span>
              <span style={{ fontWeight: 700 }}>{itemTotal.toLocaleString()}</span>
            </div>
            <div className="progress-track">
              <div style={{ display: "flex", height: "100%", width: `${(itemTotal / max) * 100}%` }}>
                {item.segments
                  .filter((s) => s.value > 0)
                  .map((s, i) => (
                    <div key={i} style={{ width: `${(s.value / itemTotal) * 100}%`, background: s.color }} />
                  ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
