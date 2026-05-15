import React from 'react';
import { Code, BracketsCurly, FileText } from 'phosphor-react';
import type { GenerationResult } from '@/types/messages';
import { colors, buttonStyle, buttonHoverStyle } from '../styles';

interface CompleteScreenProps {
  result: GenerationResult;
  onNavigateToPage: (pageId: string) => void;
  onReset: () => void;
}

interface FormatDetails {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  filename: string;
  mimeType: string;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CompleteScreen({ result, onReset }: CompleteScreenProps) {
  const [isDownloadHovering, setIsDownloadHovering] = React.useState(false);

  const { manifest, exports } = result;
  const { components } = manifest.domains;

  // Determine selected format
  const getSelectedFormat = (): FormatDetails | null => {
    const getParentName = () => {
      const comps = components.components;
      if (comps.length === 0) return 'components';
      if (comps.length === 1) {
        const name = comps[0].name;
        const parentName = name.split('/')[0];
        return parentName || name;
      }
      const names = comps.map((c) => c.name.split('/')[0]);
      const uniqueParents = [...new Set(names)];
      return uniqueParents.length === 1 ? uniqueParents[0] : 'components';
    };

    const parentName = getParentName();

    if (exports.markdown) {
      return {
        key: 'markdown',
        label: 'Markdown',
        description: 'Readable documentation',
        icon: <FileText size={48} color={colors.textPrimary} weight="regular" />,
        filename: `${parentName}.md`,
        mimeType: 'text/markdown',
      };
    }
    return null;
  };

  const format = getSelectedFormat();

  // Get total variants
  const totalVariants = components.components.reduce((sum, c) => sum + c.variants.length, 0);

  // Get component names and variant info
  const componentNames = components.components.map((c) => c.name);
  const isMultipleComponents = components.components.length > 1;

  // For multiple components, use compact summary format
  // For single component, show detailed variant chips
  const componentVariants = components.components.map((c) => ({
    name: c.name,
    variantCount: c.variants.length,
    variantSummary: isMultipleComponents
      ? // Compact: "State (3), Size (2)"
        c.variantGroups
          .map((group) => `${group.property} (${group.values.length})`)
          .join(', ')
      : // Detailed: Full chips
        c.variantGroups
          .slice(0, 2)
          .map((group) => `${group.property}: ${group.values.slice(0, 2).join(', ')}${group.values.length > 2 ? '...' : ''}`)
          .join(' · ')
  }));

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    margin: '2px 4px',
    backgroundColor: '#F5F5F5',
    border: `1px solid #E0E0E0`,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    color: colors.textPrimary,
    whiteSpace: 'nowrap' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 0,
  };

  const changeLinkStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    border: 'none',
    background: 'none',
    padding: 0,
  };

  const formatCardStyle: React.CSSProperties = {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: '16px 20px',
    marginBottom: 4,
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  };

  if (!format) {
    return <div>Error: No format selected</div>;
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Scrollable content area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 12px',
        }}
      >
        {/* Change format link */}
        <button style={changeLinkStyle} onClick={onReset}>
          <span>←</span>
          <span>Change format</span>
        </button>

        {/* Format card */}
        <div style={formatCardStyle}>
          {format.icon}
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>
            {format.label}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>
            {format.description}
          </div>
        </div>

        {/* Components selected - Scrollable section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ textAlign: 'left' as const }}>
            <div style={labelStyle}>Components selected</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {componentVariants.map((comp) => (
                <div key={comp.name} style={{
                  ...chipStyle,
                  display: 'flex',
                  flexDirection: 'column' as const,
                  alignItems: 'flex-start',
                  gap: 6,
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                }}>
                  <strong style={{ fontSize: 13, color: colors.textPrimary }}>{comp.name}</strong>
                  {comp.variantSummary && (
                    <span style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      fontWeight: 400,
                      lineHeight: 1.4,
                    }}>
                      {comp.variantSummary}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed button area - Consistent with IdleScreen */}
      <div style={{ padding: '12px', flexShrink: 0, borderTop: `1px solid ${colors.border}` }}>
        <button
          onClick={() => downloadFile(exports[format.key as keyof typeof exports]!, format.filename, format.mimeType)}
          onMouseEnter={() => setIsDownloadHovering(true)}
          onMouseLeave={() => setIsDownloadHovering(false)}
          style={{
            ...buttonStyle,
            ...(isDownloadHovering ? buttonHoverStyle : {}),
            width: '100%',
            height: 38,
            fontSize: 13,
          }}
        >
          Download
        </button>
      </div>
    </div>
  );
}
