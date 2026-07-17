interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ values, width = 200, height = 48, color = "var(--color-primary)" }: SparklineProps) {
  if (values.length < 2) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="text-tertiary" style={{ fontSize: 11 }}>
          Not enough history yet
        </span>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 4;
  const stepX = (width - padding * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const areaPoints = `${padding},${height - padding} ${points.join(" ")} ${width - padding},${height - padding}`;
  const lastPoint = points[points.length - 1].split(",").map(Number);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polygon points={areaPoints} fill={color} opacity={0.1} stroke="none" />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r={3} fill={color} />
    </svg>
  );
}
