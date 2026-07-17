export interface BarItem {
  label: string;
  value: number;
  color: string;
}

interface BarListProps {
  items: BarItem[];
}

/**
 * A ranked horizontal-bar list. Preferred over a donut once a distribution has more than ~5-6
 * segments — a donut can't be read past a handful of slices, and cramming an 11-category legend
 * into a fixed-height scrollable box (as the dashboard used to) hides entries instead of showing
 * the full ranking.
 */
export function BarList({ items }: BarListProps) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((i) => i.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
            <span className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color, display: "inline-block" }} />
              {item.label}
            </span>
            <span style={{ fontWeight: 700 }}>{item.value.toLocaleString()}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
