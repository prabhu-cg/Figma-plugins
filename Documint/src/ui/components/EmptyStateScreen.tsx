import React from 'react';
import { Cursor } from 'phosphor-react';
import { colors } from '../styles';

export function EmptyStateScreen() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        textAlign: 'center',
        background: '#FAFAFA',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#FFF9EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Cursor size={32} color={colors.textPrimary} weight="regular" />
      </div>

      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: colors.textPrimary,
            marginBottom: 8,
          }}
        >
          Ready to document?
        </div>
        <div
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Select one or more frames in your Figma file to extract and document your design system.
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          padding: '10px 12px',
          background: 'rgba(238, 102, 29, 0.1)',
          borderRadius: 6,
          border: '1px solid rgba(238, 102, 29, 0.2)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: colors.textSecondary,
            lineHeight: 1.4,
          }}
        >
          💡 <strong>Tip:</strong> Select design system components, typography frames, or color palettes.
        </div>
      </div>
    </div>
  );
}
