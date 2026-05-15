import React from 'react';

export interface DetectedPages {
  core: string[];
  icons: string[];
  examples: string[];
  other: string[];
}

interface PageSelectionPanelProps {
  detectedPages: DetectedPages | null;
  selectedPages: Set<string>;
  onPageToggle: (pageName: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const containerStyle: React.CSSProperties = {
  padding: '12px',
  backgroundColor: '#f5f5f5',
  borderRadius: '4px',
  marginBottom: '12px',
  border: '1px solid #e0e0e0',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  marginBottom: '8px',
  fontWeight: 600,
  fontSize: '14px',
};

const toggleIconStyle: React.CSSProperties = {
  marginRight: '6px',
  transition: 'transform 0.2s',
  transform: 'rotate(0deg)',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxHeight: '200px',
  overflow: 'auto',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '12px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#666',
  textTransform: 'uppercase',
  marginBottom: '6px',
};

const checkboxContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px',
};

const checkboxStyle: React.CSSProperties = {
  cursor: 'pointer',
  accentColor: '#3b82f6',
};

const labelStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontSize: '13px',
  userSelect: 'none',
};

export function PageSelectionPanel({
  detectedPages,
  selectedPages,
  onPageToggle,
  isExpanded,
  onToggleExpand,
}: PageSelectionPanelProps) {
  if (!detectedPages) {
    return null;
  }

  const allPages = [
    ...detectedPages.core,
    ...detectedPages.icons,
    ...detectedPages.examples,
    ...detectedPages.other,
  ];

  const categories = [
    { title: 'Core Design System', pages: detectedPages.core, color: '#10b981' },
    { title: 'Icons', pages: detectedPages.icons, color: '#f59e0b' },
    { title: 'Examples (excluded)', pages: detectedPages.examples, color: '#ef4444' },
    { title: 'Other', pages: detectedPages.other, color: '#6b7280' },
  ];

  return (
    <div style={containerStyle}>
      <div style={headerStyle} onClick={onToggleExpand}>
        <span style={{ ...toggleIconStyle, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        📄 Page Selection ({selectedPages.size} of {allPages.length} selected)
      </div>

      {isExpanded && (
        <div style={contentStyle}>
          {categories.map((category) => (
            <div key={category.title} style={sectionStyle}>
              <div style={sectionTitleStyle}>
                <span style={{ marginRight: '4px', color: category.color }}>●</span>
                {category.title}
              </div>
              {category.pages.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#999' }}>No pages detected</div>
              ) : (
                category.pages.map((page) => (
                  <div key={page} style={checkboxContainerStyle}>
                    <input
                      type="checkbox"
                      style={checkboxStyle}
                      checked={selectedPages.has(page)}
                      onChange={() => onPageToggle(page)}
                      id={`page-${page}`}
                    />
                    <label htmlFor={`page-${page}`} style={labelStyle}>
                      {page}
                    </label>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
