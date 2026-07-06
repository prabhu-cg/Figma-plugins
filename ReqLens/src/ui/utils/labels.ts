import type { ComponentCategory } from '@core/types/analysis.types';
import type { QuestionGroup } from '@core/types/question.types';

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  button: 'Button',
  input: 'Input',
  dropdown: 'Dropdown',
  search: 'Search',
  table: 'Table',
  card: 'Card',
  modal: 'Modal',
  navigation: 'Navigation',
  chart: 'Chart',
  tabs: 'Tabs',
  accordion: 'Accordion',
};

export const GROUP_LABELS: Record<QuestionGroup, string> = {
  business: 'Business',
  functional: 'Functional',
  'non-functional': 'Non-Functional',
  security: 'Security',
  accessibility: 'Accessibility',
};

export const GROUP_ORDER: readonly QuestionGroup[] = [
  'business',
  'functional',
  'non-functional',
  'security',
  'accessibility',
];

export const PRIORITY_TONE = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
} as const;
