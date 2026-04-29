import React from 'react';
import type { HealthWarning } from '@/types/schemas';
import {
  colors,
  warningRowStyle,
  warningIconStyle,
  warningContentStyle,
  warningMessageStyle,
  warningSuggestionStyle,
} from '../styles';

interface WarningListProps {
  warnings: HealthWarning[];
}

export function WarningList({ warnings }: WarningListProps) {
  if (warnings.length === 0) {
    return <div style={{ padding: '8px 0', color: colors.textSecondary, fontSize: 11 }}>No warnings</div>;
  }

  return (
    <div>
      {warnings.map((warning, i) => {
        const iconColor = (() => {
          switch (warning.severity) {
            case 'error':
              return colors.error;
            case 'warning':
              return colors.warning;
            case 'info':
              return colors.info;
            default:
              return colors.textSecondary;
          }
        })();

        return (
          <div key={i} style={warningRowStyle}>
            <div style={{ ...warningIconStyle, background: iconColor }} />
            <div style={warningContentStyle}>
              <div style={warningMessageStyle}>{warning.message}</div>
              {warning.suggestion && (
                <div style={warningSuggestionStyle}>{warning.suggestion}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
