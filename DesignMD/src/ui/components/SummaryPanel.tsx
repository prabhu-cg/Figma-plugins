import type { DesignSystemSummary } from '@shared/types';

interface SummaryPanelProps {
  summary: DesignSystemSummary;
}

const STAT_LABELS: Array<[keyof DesignSystemSummary, string]> = [
  ['variableCollectionsCount', 'Variable Collections'],
  ['variablesCount', 'Variables'],
  ['componentsCount', 'Components'],
  ['componentSetsCount', 'Component Sets'],
  ['textStylesCount', 'Text Styles'],
  ['colorStylesCount', 'Color Styles'],
  ['modesCount', 'Modes'],
];

export function SummaryPanel({ summary }: SummaryPanelProps) {
  return (
    <section className="dmd-section">
      <h2 className="dmd-section-title">Design system summary</h2>
      <div className="dmd-stat-grid">
        {STAT_LABELS.map(([key, label]) => (
          <div className="dmd-stat-tile" key={key}>
            <span className="dmd-stat-value">{summary[key]}</span>
            <span className="dmd-stat-label">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
