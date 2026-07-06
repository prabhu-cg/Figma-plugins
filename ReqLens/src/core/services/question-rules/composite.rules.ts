import type { DetectedComponent, FrameAnalysis } from '@core/types/analysis.types';
import type { CompositeRule } from '@core/types/question.types';

function byCategory(frame: FrameAnalysis, category: DetectedComponent['category']): DetectedComponent[] {
  return frame.components.filter((c) => c.category === category);
}

/** There's no dedicated "export" analyzer — an export affordance is a button whose name/label says so. */
function findExportButton(frame: FrameAnalysis): DetectedComponent | undefined {
  return byCategory(frame, 'button').find((button) => /export|download/i.test(`${button.nodeName} ${button.label ?? ''}`));
}

/**
 * Cross-component patterns: questions that only make sense when two or more
 * component types co-occur in the same frame. Each rule is independent and
 * declarative — add, remove, or edit entries here to reconfigure the engine.
 */
export const compositeRules: CompositeRule[] = [
  {
    kind: 'composite',
    id: 'table-search-export',
    description: 'Table + search + an export/download button detected together',
    group: 'functional',
    priority: 'high',
    matches: (frame) => {
      const tables = byCategory(frame, 'table');
      const searches = byCategory(frame, 'search');
      const exportButton = findExportButton(frame);
      if (tables.length === 0 || searches.length === 0 || !exportButton) return null;
      return [...tables, ...searches, exportButton];
    },
    questions: () => [
      'Should exports respect the currently applied filters and search terms?',
      'What is the maximum export size (row count or file size)?',
      'Can users save and reuse filter presets?',
      'Should exports be logged/audited for compliance?',
    ],
  },
  {
    kind: 'composite',
    id: 'table-without-search',
    description: 'A table exists with no search component in the same frame',
    group: 'functional',
    priority: 'medium',
    matches: (frame) => {
      const tables = byCategory(frame, 'table');
      const searches = byCategory(frame, 'search');
      if (tables.length === 0 || searches.length > 0) return null;
      return tables;
    },
    questions: () => [
      'This table has no visible search — should one be added if the dataset can grow large?',
    ],
  },
  {
    kind: 'composite',
    id: 'navigation-and-search',
    description: 'Navigation and search both detected in the same frame',
    group: 'business',
    priority: 'low',
    matches: (frame) => {
      const navs = byCategory(frame, 'navigation');
      const searches = byCategory(frame, 'search');
      if (navs.length === 0 || searches.length === 0) return null;
      return [...navs, ...searches];
    },
    questions: () => [
      'Is this search scoped to the current section, or should it search globally across the app?',
    ],
  },
];
