import type { SingleComponentRule } from '@core/types/question.types';

/**
 * One or more rules per detected-component category, split by requirement
 * group (business/functional/non-functional/security) so a single detected
 * component can surface questions across multiple sections of the exported
 * requirements doc. Each rule fires for every matching component and expands
 * into one GeneratedQuestion per string returned by `questions`. Add, edit,
 * or remove entries here to reconfigure what gets asked — no engine changes needed.
 */
export const singleComponentRules: SingleComponentRule[] = [
  // ---- Button ----
  {
    kind: 'single',
    id: 'button.action',
    description: 'A button was detected',
    appliesTo: 'button',
    group: 'functional',
    priority: 'high',
    questions: () => [
      'What action should occur when this button is clicked?',
      'Is confirmation required before the action completes?',
      'Is the action reversible (e.g. undo), or is it permanent?',
    ],
  },
  {
    kind: 'single',
    id: 'button.analytics',
    description: 'A button was detected',
    appliesTo: 'button',
    group: 'non-functional',
    priority: 'low',
    questions: () => ['Should analytics tracking occur on click?'],
  },
  {
    kind: 'single',
    id: 'button.permissions',
    description: 'A button was detected',
    appliesTo: 'button',
    group: 'security',
    priority: 'medium',
    questions: () => ['Are permissions required to see or use this button?'],
  },

  // ---- Input ----
  {
    kind: 'single',
    id: 'input.validation',
    description: 'An input field was detected',
    appliesTo: 'input',
    group: 'functional',
    priority: 'high',
    questions: () => [
      'Is this field mandatory or optional?',
      'What validation rules apply to this field?',
      'What is the maximum (and minimum) length allowed?',
      'Are there specific formatting requirements (e.g. currency, phone, date)?',
    ],
  },
  {
    kind: 'single',
    id: 'input.ux',
    description: 'An input field was detected',
    appliesTo: 'input',
    group: 'non-functional',
    priority: 'medium',
    questions: () => [
      'Should autocomplete or suggestions be enabled?',
      'Should the entered value persist across sessions or page reloads?',
    ],
  },

  // ---- Dropdown ----
  {
    kind: 'single',
    id: 'dropdown.core',
    description: 'A dropdown/select was detected',
    appliesTo: 'dropdown',
    group: 'functional',
    priority: 'high',
    questions: () => [
      'What values populate this dropdown?',
      'Is the list of options static or dynamically sourced?',
      'Is this single-select or multi-select?',
      'Is there a default selection?',
      'Should the options be searchable/filterable?',
    ],
  },

  // ---- Table ----
  {
    kind: 'single',
    id: 'table.core',
    description: 'A data table was detected',
    appliesTo: 'table',
    group: 'functional',
    priority: 'high',
    questions: () => [
      'What columns are required, and which are optional/configurable?',
      'What is the default sort order?',
      'What filtering options should be available?',
      'What are the pagination requirements (page size, infinite scroll, etc.)?',
      'Is export functionality required for this table?',
      'What row-level actions are needed?',
      'What should the empty state look like when there is no data?',
    ],
  },

  // ---- Search ----
  {
    kind: 'single',
    id: 'search.core',
    description: 'A search component was detected',
    appliesTo: 'search',
    group: 'functional',
    priority: 'high',
    questions: () => [
      'Which fields or data should be searchable?',
      'Is there a minimum character count before search executes?',
      'Should there be a debounce/delay before searching?',
      'Should matching be exact or fuzzy?',
      'What should happen when there are no results?',
    ],
  },

  // ---- Modal ----
  {
    kind: 'single',
    id: 'modal.core',
    description: 'A modal/dialog was detected',
    appliesTo: 'modal',
    group: 'functional',
    priority: 'medium',
    questions: () => [
      'What triggers this modal to open?',
      'Can this modal be dismissed (backdrop click, Esc key, close button)?',
      'Is confirmation required before closing if data has been entered?',
    ],
  },
  {
    kind: 'single',
    id: 'modal.data-retention',
    description: 'A modal/dialog was detected',
    appliesTo: 'modal',
    group: 'non-functional',
    priority: 'medium',
    questions: () => ['Should entered data be retained if the modal is closed and reopened?'],
  },

  // ---- Navigation ----
  {
    kind: 'single',
    id: 'navigation.security',
    description: 'A navigation component was detected',
    appliesTo: 'navigation',
    group: 'security',
    priority: 'high',
    questions: () => [
      'Are there access restrictions on any navigation items?',
      'Should any items have role-based visibility?',
    ],
  },
  {
    kind: 'single',
    id: 'navigation.business',
    description: 'A navigation component was detected',
    appliesTo: 'navigation',
    group: 'business',
    priority: 'medium',
    questions: () => [
      'What is the default landing page/route?',
      'Should this support deep-linking directly to sub-sections?',
    ],
  },

  // ---- Chart ----
  {
    kind: 'single',
    id: 'chart.core',
    description: 'A chart/graph was detected',
    appliesTo: 'chart',
    group: 'functional',
    priority: 'medium',
    questions: () => [
      'What is the data source for this chart?',
      'How frequently should the data refresh?',
      'Are drill-down interactions required (e.g. clicking a segment)?',
    ],
  },
  {
    kind: 'single',
    id: 'chart.export',
    description: 'A chart/graph was detected',
    appliesTo: 'chart',
    group: 'business',
    priority: 'low',
    questions: () => ['Are there export requirements for the chart or its underlying data?'],
  },

  // ---- Tabs ----
  {
    kind: 'single',
    id: 'tabs.core',
    description: 'A tab group was detected',
    appliesTo: 'tabs',
    group: 'functional',
    priority: 'medium',
    questions: () => [
      'How many tabs are needed, and can that number grow dynamically?',
      'Should the active tab persist across sessions or page reloads?',
      'Should each tab lazy-load its content, or load all tabs upfront?',
    ],
  },

  // ---- Accordion ----
  {
    kind: 'single',
    id: 'accordion.core',
    description: 'An accordion was detected',
    appliesTo: 'accordion',
    group: 'functional',
    priority: 'low',
    questions: () => [
      'Can multiple sections be expanded at once, or only one at a time?',
      'What should the default expanded/collapsed state be?',
      'Should expand/collapse state persist across sessions?',
    ],
  },
];
