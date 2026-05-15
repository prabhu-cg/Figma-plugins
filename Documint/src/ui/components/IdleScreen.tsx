import React from 'react';
import { FileText, FigmaLogo, Check } from 'phosphor-react';
import type { GenerationOptions, ProgressStep } from '@/types/messages';
import type { DetectedPages } from '@/plugin/filter/page-detection';
import {
  buttonStyle,
  buttonHoverStyle,
  buttonDisabledStyle,
  STEP_LABELS,
  exportCardStyle,
  exportCardHoverStyle,
  colors,
} from '../styles';

function SpinnerRing({ minting }: { minting: boolean }) {
  return (
    <div style={{
      width: 14,
      height: 14,
      borderRadius: '50%',
      border: `2px solid ${minting ? 'rgba(102,102,102,0.25)' : 'rgba(255,255,255,0.3)'}`,
      borderTopColor: minting ? '#666666' : '#ffffff',
      animation: 'spin 0.75s linear infinite',
      flexShrink: 0,
    }} />
  );
}

interface IdleScreenProps {
  selectionCount: number;
  options: GenerationOptions;
  onOptionsChange: (options: GenerationOptions) => void;
  onGenerate: () => void;
  onCancel?: () => void;
  isMinting?: boolean;
  mintingStep?: ProgressStep;
  mintingPercent?: number;
  detectedPages?: DetectedPages;
  selectedPages?: Set<string>;
  onPageToggle?: (pageName: string) => void;
  onSetSelectedPages?: (pages: Set<string>) => void;
  onRequestPages?: () => void;
}

const exportOptions = [
  {
    key: 'exportMarkdown' as const,
    title: 'Markdown',
    description: 'Semantic machine-readable docs\nPerfect for AI, version control, and design-to-code workflows',
    icon: <FileText size={24} color={colors.textPrimary} weight="regular" />,
  },
  {
    key: 'exportFigmaPage' as const,
    title: 'Figma Page',
    description: 'Visual reference page created\ninside your design file for easy sharing and navigation',
    icon: <FigmaLogo size={24} color={colors.textPrimary} weight="regular" />,
  },
];

const markdownModes = [
  {
    key: 'selected' as const,
    title: 'Selected Components',
    description: 'Document only the components\nyou\'ve selected on this page (fastest)',
  },
  {
    key: 'current-page' as const,
    title: 'Current Page Scan',
    description: 'All tokens, styles, and components\non the current page',
  },
  {
    key: 'full-system' as const,
    title: 'Full Design System',
    description: 'Entire design system across\nall pages in this file',
  },
];

export function IdleScreen({
  selectionCount,
  options,
  onOptionsChange,
  onGenerate,
  onCancel,
  isMinting = false,
  mintingStep,
  mintingPercent,
  detectedPages,
  selectedPages,
  onPageToggle,
  onSetSelectedPages,
  onRequestPages,
}: IdleScreenProps) {
  const [hoveredCard, setHoveredCard] = React.useState<string | null>(null);
  const [isHoveringButton, setIsHoveringButton] = React.useState(false);
  const [markdownExpanded, setMarkdownExpanded] = React.useState(false);

  const exportFormatKeys: (keyof GenerationOptions)[] = ['exportMarkdown', 'exportFigmaPage'];
  const selectedKey = Object.entries(options)
    .filter(([key]) => exportFormatKeys.includes(key as keyof GenerationOptions))
    .find(([_, value]) => value)?.[0] as keyof GenerationOptions | undefined;

  const handleOptionChange = (key: keyof GenerationOptions) => {
    if (key === 'exportMarkdown') {
      setMarkdownExpanded(!markdownExpanded);
    }
    onOptionsChange({
      exportMarkdown: key === 'exportMarkdown',
      exportFigmaPage: key === 'exportFigmaPage',
      markdownMode: options.markdownMode || 'selected',
      useComponentDocEngine: options.useComponentDocEngine,
    });
  };

  const handleModeChange = (mode: 'selected' | 'current-page' | 'full-system') => {
    onOptionsChange({
      ...options,
      markdownMode: mode,
    });
    if (mode === 'full-system' && !detectedPages && onRequestPages) {
      onRequestPages();
    }
  };

  const totalPages = detectedPages
    ? detectedPages.core.length + detectedPages.icons.length + detectedPages.examples.length + detectedPages.other.length
    : 0;

  const canGenerate =
    selectionCount > 0 &&
    selectedKey &&
    (selectedKey === 'exportFigmaPage' ||
      (options.markdownMode !== 'full-system') ||
      (options.markdownMode === 'full-system' && (selectedPages?.size ?? 0) > 0));

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Generating summary — shown instead of options while minting */}
      {isMinting && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '24px 20px',
          textAlign: 'center' as const,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, marginBottom: 4 }}>
            Generating your documentation
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 6,
            background: colors.hoverBg,
            border: `1px solid ${colors.borderHover}`,
            fontSize: 11,
            color: colors.borderHover,
            fontWeight: 500,
          }}>
            {options.exportMarkdown ? 'Markdown' : 'Figma Page'}
            {options.exportMarkdown && options.markdownMode && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                {options.markdownMode === 'full-system' ? 'Full design system' :
                 options.markdownMode === 'current-page' ? 'Current page' :
                 'Selected components'}
              </>
            )}
            {options.markdownMode === 'full-system' && selectedPages && selectedPages.size > 0 && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''}
              </>
            )}
          </div>
        </div>
      )}

      {/* Scrollable content area - only this section scrolls */}
      {!isMinting && <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minHeight: 0,
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>
            Choose export option
          </div>
          <div style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.4 }}>
            Select how you'd like to generate your design system documentation
          </div>
        </div>

        {/* Premium Cards Layout */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {/* Markdown Card - Expandable */}
          <div
            onClick={() => handleOptionChange('exportMarkdown')}
            style={{
              ...exportCardStyle,
              ...(hoveredCard === 'exportMarkdown' && !selectedKey?.includes('Markdown') ? exportCardHoverStyle : {}),
              ...(selectedKey === 'exportMarkdown' ? {
                border: `2px solid ${colors.borderHover}`,
                background: colors.hoverBg,
              } : {}),
            }}
            onMouseEnter={() => setHoveredCard('exportMarkdown')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            {/* Icon */}
            <div
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                backgroundColor: selectedKey === 'exportMarkdown' ? colors.hoverBg : '#F5F5F5',
              }}
            >
              <FileText size={24} color={colors.textPrimary} weight="regular" />
            </div>

            {/* Text Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.textPrimary, marginBottom: 6 }}>
                Markdown
              </div>
              <div style={{
                fontSize: 11,
                color: colors.textSecondary,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                Semantic machine-readable docs
                Perfect for AI, version control, and design-to-code workflows
              </div>
            </div>

            {/* Selection Checkmark */}
            {selectedKey === 'exportMarkdown' && (
              <div
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: colors.borderHover,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={14} color="white" weight="bold" />
              </div>
            )}
          </div>

          {/* Markdown Mode Options - Expanded View */}
          {selectedKey === 'exportMarkdown' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column' as const,
              gap: 8,
              paddingLeft: 8,
              paddingRight: 8,
              animation: 'slideDown 0.3s ease-out',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary, marginTop: 4 }}>
                Generation Mode:
              </div>

              {markdownModes.map((mode) => {
                const isSelected = options.markdownMode === mode.key;
                return (
                  <div
                    key={mode.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModeChange(mode.key);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1.5px solid ${isSelected ? colors.borderHover : '#e0e0e0'}`,
                      backgroundColor: isSelected ? colors.hoverBg : '#fafafa',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? colors.hoverBg : '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? colors.hoverBg : '#fafafa';
                    }}
                  >
                    {/* Radio Button */}
                    <div style={{
                      flexShrink: 0,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? colors.borderHover : '#ccc'}`,
                      backgroundColor: isSelected ? colors.borderHover : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                    }}>
                      {isSelected && (
                        <div style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: 'white',
                        }} />
                      )}
                    </div>

                    {/* Mode Description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>
                        {mode.title}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: colors.textSecondary,
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {mode.description}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Inline Page Selection — only when full-system and pages are detected */}
              {options.markdownMode === 'full-system' && detectedPages && onPageToggle && (() => {
                const allPageNames = [
                  ...detectedPages.foundations,
                  ...detectedPages.core,
                  ...detectedPages.icons,
                  ...detectedPages.other,
                  ...detectedPages.examples,
                ];
                const selectedCount = selectedPages?.size ?? 0;
                const categories = [
                  { title: 'Foundations', pages: detectedPages.foundations, hint: 'colors · typography · spacing' },
                  { title: 'Icons', pages: detectedPages.icons },
                  { title: 'Components', pages: [...detectedPages.core, ...detectedPages.other] },
                  { title: 'Examples', pages: detectedPages.examples, hint: 'excluded by default' },
                ].filter((cat) => cat.pages.length > 0);

                return (
                  <div style={{
                    marginTop: 4,
                    borderRadius: 8,
                    border: `1.5px solid ${colors.border}`,
                    backgroundColor: '#fafafa',
                    display: 'flex',
                    flexDirection: 'column' as const,
                    maxHeight: 216,
                  }}>
                    {/* Sticky header — always visible */}
                    <div style={{
                      flexShrink: 0,
                      padding: '9px 12px 8px',
                      borderBottom: `1px solid ${colors.border}`,
                      borderRadius: '8px 8px 0 0',
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary }}>
                        Pages to include
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 10, color: colors.textSecondary }}>
                          {selectedCount} of {totalPages}
                        </span>
                        {onSetSelectedPages && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); onSetSelectedPages(new Set(allPageNames)); }}
                              style={{ fontSize: 10, color: colors.borderHover, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                            >
                              All
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onSetSelectedPages(new Set()); }}
                              style={{ fontSize: 10, color: colors.textTertiary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              None
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Scrollable page list */}
                    <div style={{ flex: 1, overflowY: 'auto' as const, padding: '8px 10px 10px' }}>
                      {categories.map((cat) => (
                        <div key={cat.title} style={{ marginBottom: 6 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 5,
                            marginBottom: 3,
                            paddingLeft: 2,
                          }}>
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: colors.textTertiary,
                              textTransform: 'uppercase' as const,
                              letterSpacing: 0.8,
                            }}>
                              {cat.title}
                            </span>
                            {'hint' in cat && cat.hint && (
                              <span style={{ fontSize: 9, color: colors.textTertiary, fontStyle: 'italic' }}>
                                — {cat.hint}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 1 }}>
                            {cat.pages.map((page) => {
                              const isChecked = selectedPages?.has(page) ?? false;
                              return (
                                <div
                                  key={page}
                                  onClick={(e) => { e.stopPropagation(); onPageToggle(page); }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 9,
                                    padding: '5px 6px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    backgroundColor: isChecked ? '#FFF9EB' : 'transparent',
                                    transition: 'background 0.12s',
                                    userSelect: 'none' as const,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isChecked) (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5';
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.backgroundColor = isChecked ? '#FFF9EB' : 'transparent';
                                  }}
                                >
                                  {/* Custom checkbox */}
                                  <div style={{
                                    flexShrink: 0,
                                    width: 14,
                                    height: 14,
                                    borderRadius: 3,
                                    border: `1.5px solid ${isChecked ? colors.borderHover : '#c8c8c8'}`,
                                    backgroundColor: isChecked ? colors.borderHover : '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.12s',
                                  }}>
                                    {isChecked && (
                                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </div>
                                  <span style={{
                                    fontSize: 11,
                                    color: isChecked ? colors.textPrimary : colors.textSecondary,
                                    fontWeight: isChecked ? 500 : 400,
                                    transition: 'color 0.12s',
                                  }}>
                                    {page}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Waiting for pages to load */}
              {options.markdownMode === 'full-system' && !detectedPages && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1.5px solid ${colors.border}`,
                  backgroundColor: '#fafafa',
                  fontSize: 11,
                  color: colors.textSecondary,
                  textAlign: 'center' as const,
                }}>
                  Scanning pages…
                </div>
              )}
            </div>
          )}

          {/* Figma Page Card - Simple Toggle */}
          <div
            onClick={() => handleOptionChange('exportFigmaPage')}
            style={{
              ...exportCardStyle,
              ...(hoveredCard === 'exportFigmaPage' && selectedKey !== 'exportFigmaPage' ? exportCardHoverStyle : {}),
              ...(selectedKey === 'exportFigmaPage' ? {
                border: `2px solid ${colors.borderHover}`,
                background: colors.hoverBg,
              } : {}),
            }}
            onMouseEnter={() => setHoveredCard('exportFigmaPage')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            {/* Icon */}
            <div
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                backgroundColor: selectedKey === 'exportFigmaPage' ? colors.hoverBg : '#F5F5F5',
              }}
            >
              <FigmaLogo size={24} color={colors.textPrimary} weight="regular" />
            </div>

            {/* Text Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.textPrimary, marginBottom: 6 }}>
                Figma Page
              </div>
              <div style={{
                fontSize: 11,
                color: colors.textSecondary,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                Visual reference page created
                inside your design file for easy sharing and navigation
              </div>
            </div>

            {/* Selection Checkmark */}
            {selectedKey === 'exportFigmaPage' && (
              <div
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: colors.borderHover,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={14} color="white" weight="bold" />
              </div>
            )}
          </div>
        </div>

        {/* CSS for animation */}
        <style>{`
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>}

      {/* Fixed footer */}
      <div style={{ padding: '12px 16px 16px', flexShrink: 0, borderTop: `1px solid ${colors.border}` }}>
        {isMinting ? (
          <>
            {/* Progress bar — sits just above the button */}
            <div style={{ height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%',
                borderRadius: 2,
                backgroundColor: colors.borderHover,
                width: `${mintingPercent ?? 0}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            {/* Single button: spinner + step on left, cancel on right */}
            <button
              onClick={onCancel}
              style={{
                width: '100%',
                height: 40,
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: '#f5f5f5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: 8,
                boxSizing: 'border-box' as const,
              }}
            >
              <SpinnerRing minting={true} />
              <span style={{ flex: 1, textAlign: 'left', fontSize: 12, color: colors.textSecondary }}>
                {mintingStep ? STEP_LABELS[mintingStep] : 'Generating…'}
              </span>
              <span style={{ fontSize: 11, color: colors.textTertiary, marginRight: 8 }}>
                {mintingPercent ?? 0}%
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: colors.textSecondary,
                borderLeft: `1px solid ${colors.border}`,
                paddingLeft: 10,
              }}>
                Cancel
              </span>
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 11, color: colors.textSecondary }}>
              {selectionCount} item{selectionCount !== 1 ? 's' : ''} selected
            </div>
            <button
              onClick={onGenerate}
              disabled={!canGenerate}
              onMouseEnter={() => setIsHoveringButton(true)}
              onMouseLeave={() => setIsHoveringButton(false)}
              style={{
                ...buttonStyle,
                ...(isHoveringButton && canGenerate ? buttonHoverStyle : {}),
                ...(!canGenerate ? buttonDisabledStyle : {}),
                width: '100%',
                height: 40,
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Generate docs
            </button>
          </>
        )}
      </div>
    </div>
  );
}
