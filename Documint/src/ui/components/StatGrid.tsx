import React from 'react';
import {
  statGridStyle,
  statCellStyle,
  statLabelStyle,
  statValueStyle,
} from '../styles';

interface Stat {
  label: string;
  value: number;
}

interface StatGridProps {
  stats: Stat[];
}

export function StatGrid({ stats }: StatGridProps) {
  return (
    <div style={statGridStyle}>
      {stats.map((stat) => (
        <div key={stat.label} style={statCellStyle}>
          <div style={statLabelStyle}>{stat.label}</div>
          <div style={statValueStyle}>{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
