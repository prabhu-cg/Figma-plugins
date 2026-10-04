import type { DesignSystem } from '@shared/types';
import { joinSections, mdHeading, mdTable } from '../markdown';

export function overviewSection(ds: DesignSystem): string {
  const { summary, metadata } = ds;
  const rows = [
    ['Source File', metadata.fileName],
    ['Generated', metadata.generatedAt],
    ['Variable Collections', String(summary.variableCollectionsCount)],
    ['Variables', String(summary.variablesCount)],
    ['Modes', String(summary.modesCount)],
    ['Components', String(summary.componentsCount)],
    ['Component Sets', String(summary.componentSetsCount)],
    ['Text Styles', String(summary.textStylesCount)],
    ['Color Styles', String(summary.colorStylesCount)],
    ['Effect Styles', String(summary.effectStylesCount)],
    ['Grid Styles', String(summary.gridStylesCount)],
  ];
  return joinSections([
    mdHeading(2, 'Overview'),
    'This document was generated automatically by **DesignMD** from a Figma design system. ' +
      "It is derived entirely from the file's Variables and Styles — no content below was generated or altered by AI.\n",
    mdTable(['Metric', 'Value'], rows),
  ]);
}

export function collectionsSection(ds: DesignSystem): string {
  const rows = ds.collections.map((c) => [
    c.name,
    c.modes.map((m) => m.name).join(', ') || '—',
    String(c.variableIds.length),
  ]);
  return joinSections([
    mdHeading(2, 'Variable Collections'),
    mdTable(['Collection', 'Modes', 'Variable Count'], rows),
  ]);
}
