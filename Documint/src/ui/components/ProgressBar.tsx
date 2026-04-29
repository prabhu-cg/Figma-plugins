import React from 'react';
import { progressBarContainerStyle, progressBarFillStyle, progressTextStyle } from '../styles';

interface ProgressBarProps {
  percent: number;
}

export function ProgressBar({ percent }: ProgressBarProps) {
  return (
    <div>
      <div style={progressBarContainerStyle}>
        <div style={progressBarFillStyle(percent)} />
      </div>
      <div style={progressTextStyle}>{percent}%</div>
    </div>
  );
}
