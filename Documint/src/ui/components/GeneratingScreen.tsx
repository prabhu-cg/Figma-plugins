import React from 'react';
import type { ProgressStep } from '@/types/messages';
import { ProgressBar } from './ProgressBar';
import { STEP_LABELS, screenStyle, stepLabelStyle, ghostButtonStyle, colors } from '../styles';

interface GeneratingScreenProps {
  step: ProgressStep;
  percent: number;
  onCancel: () => void;
}

export function GeneratingScreen({ step, percent, onCancel }: GeneratingScreenProps) {
  const [isHovering, setIsHovering] = React.useState(false);

  return (
    <div style={{ ...screenStyle, justifyContent: 'center', gap: 20 }}>
      <div style={stepLabelStyle}>{STEP_LABELS[step]}</div>

      <div style={{ width: '100%', maxWidth: 200 }}>
        <ProgressBar percent={percent} />
      </div>

      <button
        onClick={onCancel}
        style={{
          ...ghostButtonStyle,
          ...(isHovering ? { borderColor: colors.textSecondary, color: colors.textPrimary } : {}),
          width: '100%',
          maxWidth: 200,
          height: 40,
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        Cancel
      </button>
    </div>
  );
}
