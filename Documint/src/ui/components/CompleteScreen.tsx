import React from 'react';
import type { GenerationResult } from '@/types/messages';
import { TabBar } from './TabBar';
import { StatGrid } from './StatGrid';
import { WarningList } from './WarningList';
import {
  colors,
  tabContentStyle,
  ghostButtonStyle,
  buttonStyle,
  buttonHoverStyle,
  scoreRingStyle,
  scoreValueStyle,
  subScoreRowStyle,
  subScoreLabelStyle,
  subScoreBarStyle,
  subScoreBarFillStyle,
  exportRowStyle,
  exportRowLastStyle,
  exportLabelStyle,
} from '../styles';

interface CompleteScreenProps {
  result: GenerationResult;
  onNavigateToPage: (pageId: string) => void;
  onReset: () => void;
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

function getScoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.error;
}

export function CompleteScreen({ result, onNavigateToPage, onReset }: CompleteScreenProps) {
  const [activeTab, setActiveTab] = React.useState<'summary' | 'health' | 'export'>('summary');
  const [isHovering, setIsHovering] = React.useState(false);
  const [isDownloadHovering, setIsDownloadHovering] = React.useState<string | null>(null);

  const { manifest, exports } = result;
  const { metadata, health } = manifest.domains;

  const stats = [
    { label: 'Colors', value: metadata.counts.colorTokens },
    { label: 'Typography', value: metadata.counts.typographyTokens },
    { label: 'Spacing', value: metadata.counts.spacingTokens },
    { label: 'Grids', value: metadata.counts.gridTokens },
    { label: 'Components', value: metadata.counts.components },
    { label: 'Variants', value: metadata.counts.variants },
  ];

  const renderSummaryTab = () => (
    <div style={tabContentStyle}>
      <StatGrid stats={stats} />
    </div>
  );

  const renderHealthTab = () => (
    <div style={tabContentStyle}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            ...scoreRingStyle,
            borderColor: getScoreColor(health.overallScore),
          }}
        >
          <div style={scoreValueStyle}>{health.overallScore}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={subScoreRowStyle}>
          <div style={subScoreLabelStyle}>Foundations</div>
          <div style={subScoreBarStyle}>
            <div style={subScoreBarFillStyle(health.breakdown.foundationsScore)} />
          </div>
        </div>

        <div style={subScoreRowStyle}>
          <div style={subScoreLabelStyle}>Components</div>
          <div style={subScoreBarStyle}>
            <div style={subScoreBarFillStyle(health.breakdown.componentsScore)} />
          </div>
        </div>

        <div style={subScoreRowStyle}>
          <div style={subScoreLabelStyle}>Token Coverage</div>
          <div style={subScoreBarStyle}>
            <div style={subScoreBarFillStyle(health.breakdown.tokenCoverageScore)} />
          </div>
        </div>

        <div style={subScoreRowStyle}>
          <div style={subScoreLabelStyle}>Naming Consistency</div>
          <div style={subScoreBarStyle}>
            <div style={subScoreBarFillStyle(health.breakdown.namingConsistencyScore)} />
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 12 }}>
        WARNINGS & ISSUES
      </div>

      <WarningList warnings={health.warnings} />
    </div>
  );

  const renderExportTab = () => {
    const exportItems = [
      exports.json && { key: 'json', label: 'JSON', action: () => downloadFile(exports.json!, 'design-system.json', 'application/json') },
      exports.markdown && { key: 'md', label: 'Markdown', action: () => downloadFile(exports.markdown!, 'design-system.md', 'text/markdown') },
      exports.html && { key: 'html', label: 'HTML', action: () => downloadFile(exports.html!, 'design-system.html', 'text/html') },
      exports.figmaPageId && { key: 'figma', label: 'Figma Page', action: () => onNavigateToPage(exports.figmaPageId!) },
    ].filter(Boolean) as Array<{ key: string; label: string; action: () => void }>;

    return (
      <div style={tabContentStyle}>
        {exportItems.map((item, i) => (
          <div key={item.key} style={i === exportItems.length - 1 ? exportRowLastStyle : exportRowStyle}>
            <span style={exportLabelStyle}>{item.label}</span>
            <button
              onClick={item.action}
              style={{
                ...ghostButtonStyle,
                padding: '6px 12px',
                fontSize: 12,
              }}
            >
              {item.key === 'figma' ? 'Open' : 'Download'}
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return renderSummaryTab();
      case 'health':
        return renderHealthTab();
      case 'export':
        return renderExportTab();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex' as const,
        flexDirection: 'column' as const,
        overflow: 'hidden',
      }}
    >
      <TabBar tabs={['Summary', 'Health', 'Export']} activeIndex={['summary', 'health', 'export'].indexOf(activeTab)} onSelect={(i) => setActiveTab(['summary', 'health', 'export'][i] as any)} />

      {renderTabContent()}

      <button
        onClick={onReset}
        style={{
          ...buttonStyle,
          ...(isHovering ? buttonHoverStyle : {}),
          width: '100%',
          height: 36,
          flexShrink: 0,
          margin: '8px 0 0 0',
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        Generate Again
      </button>
    </div>
  );
}
