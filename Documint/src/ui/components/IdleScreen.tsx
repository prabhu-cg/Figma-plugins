import React from 'react';
import { FileText, Code, BracketsCurly, FigmaLogo, Lock } from 'phosphor-react';
import type { GenerationOptions } from '@/types/messages';
import {
  screenStyle,
  chooseOptionLabelStyle,
  chooseOptionDescStyle,
  exportCardStyle,
  exportCardHoverStyle,
  exportCardContentStyle,
  exportCardTitleStyle,
  exportCardDescriptionStyle,
  buttonStyle,
  buttonHoverStyle,
  buttonDisabledStyle,
  selectedBadgeStyle,
  colors,
} from '../styles';

interface IdleScreenProps {
  selectionCount: number;
  options: GenerationOptions;
  onOptionsChange: (options: GenerationOptions) => void;
  onGenerate: () => void;
}

const exportOptions = [
  {
    key: 'exportHtml' as const,
    title: 'HTML',
    description: 'Interactive web page',
    icon: <Code size={32} color={colors.textPrimary} weight="regular" />,
    available: true,
  },
  {
    key: 'exportFigmaPage' as const,
    title: 'Figma Page',
    description: 'Create in Figma',
    icon: <FigmaLogo size={32} color={colors.textPrimary} weight="regular" />,
    available: true,
  },
  {
    key: 'exportJson' as const,
    title: 'JSON',
    description: 'Structured data format',
    icon: <BracketsCurly size={32} color={colors.textPrimary} weight="regular" />,
    available: false,
    disabledReason: 'Available on Figma paid plans',
  },
  {
    key: 'exportMarkdown' as const,
    title: 'Markdown',
    description: 'Readable documentation',
    icon: <FileText size={32} color={colors.textPrimary} weight="regular" />,
    available: false,
    disabledReason: 'Available on Figma paid plans',
  },
];

export function IdleScreen({ selectionCount, options, onOptionsChange, onGenerate }: IdleScreenProps) {
  const [hoveredCard, setHoveredCard] = React.useState<string | null>(null);
  const [isHovering, setIsHovering] = React.useState(false);

  const selectedKey = Object.entries(options).find(([_, value]) => value)?.[0] as keyof GenerationOptions | undefined;

  const handleOptionChange = (key: keyof GenerationOptions) => {
    onOptionsChange({
      exportJson: false,
      exportMarkdown: false,
      exportHtml: false,
      exportFigmaPage: false,
      [key]: true,
    });
  };

  const canGenerate = selectionCount > 0 && selectedKey;

  return (
    <div style={{ ...screenStyle, flexDirection: 'column', justifyContent: 'space-between', padding: 12, gap: 8 }}>
      <div>
        <div style={{ ...chooseOptionLabelStyle, marginBottom: 10 }}>Select your format to export</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {exportOptions.map((option) => {
            const isSelected = selectedKey === option.key;
            const isHovered = hoveredCard === option.key;
            const isDisabled = !option.available;

            return (
              <div
                key={option.key}
                onClick={() => !isDisabled && handleOptionChange(option.key)}
                style={{
                  position: 'relative' as const,
                  padding: '12px 10px',
                  borderRadius: 6,
                  border: `1px solid ${isDisabled ? '#CCCCCC' : (isSelected || (isHovered && !isDisabled) ? colors.borderHover : colors.border)}`,
                  background: isDisabled ? '#F5F5F5' : (isSelected || isHovered ? '#FFF9EB' : '#FFFFFF'),
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column' as const,
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 6,
                  opacity: isDisabled ? 0.65 : 1,
                }}
                onMouseEnter={() => !isDisabled && setHoveredCard(option.key)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {isDisabled && (
                  <div style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    backgroundColor: '#FF9800',
                    borderRadius: '50%',
                    width: 18,
                    height: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Lock size={12} color="white" weight="fill" />
                  </div>
                )}
                <div
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  {option.icon}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isDisabled ? '#999999' : colors.textPrimary, lineHeight: 1.2 }}>
                    {option.title}
                  </div>
                  <div style={{ fontSize: 10, color: isDisabled ? '#AAAAAA' : colors.textSecondary, lineHeight: 1.2, marginTop: 2 }}>
                    {option.description}
                  </div>
                  {isDisabled && (
                    <div style={{ fontSize: 9, color: '#FF9800', lineHeight: 1.3, marginTop: 4, fontWeight: 500 }}>
                      Paid plan only
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ textAlign: 'center', marginBottom: 10, fontSize: 11, color: colors.textSecondary }}>
          {selectionCount} frame{selectionCount !== 1 ? 's' : ''} selected
        </div>

        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          style={{
            ...buttonStyle,
            ...(isHovering && canGenerate ? buttonHoverStyle : {}),
            ...(canGenerate ? {} : buttonDisabledStyle),
            width: '100%',
            height: 38,
            fontSize: 13,
          }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          Start minting
        </button>
      </div>
    </div>
  );
}
