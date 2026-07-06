import type { Analyzer } from './base.analyzer';
import { accordionAnalyzer } from './accordion.analyzer';
import { buttonAnalyzer } from './button.analyzer';
import { cardAnalyzer } from './card.analyzer';
import { chartAnalyzer } from './chart.analyzer';
import { dropdownAnalyzer } from './dropdown.analyzer';
import { inputAnalyzer } from './input.analyzer';
import { modalAnalyzer } from './modal.analyzer';
import { navigationAnalyzer } from './navigation.analyzer';
import { searchAnalyzer } from './search.analyzer';
import { tableAnalyzer } from './table.analyzer';
import { tabsAnalyzer } from './tabs.analyzer';

/** All registered analyzers, run in order for every analyzed frame. Add new analyzers here. */
export const analyzerRegistry: readonly Analyzer[] = [
  buttonAnalyzer,
  inputAnalyzer,
  dropdownAnalyzer,
  searchAnalyzer,
  tableAnalyzer,
  cardAnalyzer,
  modalAnalyzer,
  navigationAnalyzer,
  chartAnalyzer,
  tabsAnalyzer,
  accordionAnalyzer,
];

export * from './base.analyzer';
