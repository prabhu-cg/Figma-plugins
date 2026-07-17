export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}

const SEGMENT_GAP_PX = 1.5;

export function Donut({ segments, size = 132, thickness = 16, centerLabel, centerSub }: DonutProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;

  let cumulative = 0;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-surface-alt)" strokeWidth={thickness} />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((segment) => {
              const fraction = segment.value / total;
              const segmentLength = fraction * circumference;
              // Drawing each segment's full allocated length with butt caps means the last
              // segment's end and the first segment's start meet exactly at the same point —
              // any floating-point drift in the cumulative offset then shows up as the
              // last-drawn (topmost) segment visibly overlapping the first. Trimming a small,
              // fixed gap off the visible length guarantees a real buffer between segments
              // regardless of rounding, and doubles as the surface gap the dataviz skill
              // recommends between adjacent donut/stacked segments.
              const visibleLength = Math.max(0, segmentLength - SEGMENT_GAP_PX);
              const dasharray = `${visibleLength} ${circumference - visibleLength}`;
              const dashoffset = -cumulative;
              cumulative += segmentLength;
              return (
                <circle
                  key={segment.label}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  strokeDasharray={dasharray}
                  strokeDashoffset={dashoffset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              );
            })}
      </svg>
      {(centerLabel || centerSub) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {centerLabel && <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{centerLabel}</div>}
          {centerSub && <div style={{ fontSize: 10.5, color: "var(--color-text-secondary)", fontWeight: 600 }}>{centerSub}</div>}
        </div>
      )}
    </div>
  );
}
