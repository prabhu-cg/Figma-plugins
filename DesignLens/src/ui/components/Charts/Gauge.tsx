interface GaugeProps {
  score: number;
  size?: number;
  thickness?: number;
  label?: string;
}

export function Gauge({ score, size = 190, thickness = 18, label }: GaugeProps) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const pathLength = Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const dashoffset = pathLength * (1 - clamped / 100);
  const color = clamped >= 85 ? "var(--color-success)" : clamped >= 60 ? "var(--color-primary)" : "var(--color-critical)";
  const viewBoxHeight = size / 2 + thickness;

  return (
    <div style={{ width: size, position: "relative" }}>
      <svg width={size} height={viewBoxHeight} viewBox={`0 0 ${size} ${viewBoxHeight}`}>
        <path d={pathD} fill="none" stroke="var(--color-surface-alt)" strokeWidth={thickness} strokeLinecap="round" />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={pathLength}
          strokeDashoffset={dashoffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 2, textAlign: "center" }}>
        <div style={{ fontSize: Math.round(size * 0.2), fontWeight: 800, letterSpacing: "-0.03em", color }}>
          {Math.round(clamped)}
        </div>
        {label && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em"
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
