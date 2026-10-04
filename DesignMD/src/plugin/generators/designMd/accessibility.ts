import type { DesignSystem } from '@shared/types';
import { joinSections, mdHeading, mdList, mdTable } from '../markdown';
import { computeContrastReport, type ContrastPair, type FallbackContrastCheck } from '../contrast';

const MAX_FAILING_ROWS = 100;

function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

function contrastPairsTable(pairs: ContrastPair[]): string {
  const rows = pairs.map((p) => [
    p.foreground.name,
    p.background.name,
    formatRatio(p.ratio),
    p.passesAANormal ? 'Pass' : 'Fail',
    p.passesAALarge ? 'Pass' : 'Fail',
  ]);
  return mdTable(
    ['Foreground', 'Background', 'Ratio', 'AA Normal (4.5:1)', 'AA Large (3:1)'],
    rows,
  );
}

function fallbackChecksTable(checks: FallbackContrastCheck[]): string {
  const rows = checks.map((c) => [
    c.token.name,
    c.token.cssName,
    `${formatRatio(c.ratioOnWhite)} (${c.passesOnWhite ? 'Pass' : 'Fail'})`,
    `${formatRatio(c.ratioOnBlack)} (${c.passesOnBlack ? 'Pass' : 'Fail'})`,
  ]);
  return mdTable(['Token', 'CSS Variable', 'On White', 'On Black'], rows);
}

function colorContrastSection(ds: DesignSystem): string {
  const report = computeContrastReport(ds);
  const notes: string[] = [];
  if (report.skippedTranslucentCount > 0) {
    notes.push(
      `${report.skippedTranslucentCount} color token(s) were skipped — partial opacity makes their ` +
        'effective contrast depend on whatever they end up composited over.',
    );
  }

  if (report.totalColorTokensChecked === 0) {
    return joinSections([
      mdHeading(3, 'Color Contrast'),
      '_No opaque color tokens available to check._\n',
    ]);
  }

  if (report.pairs.length > 0) {
    const failing = report.pairs.filter((p) => !p.passesAALarge).slice(0, MAX_FAILING_ROWS);
    notes.unshift(
      `Checked ${report.totalPairs} foreground/background token pair(s), inferred from naming ` +
        'conventions and variable scopes (e.g. "Text/*" vs "Surface/*" names, or TEXT_FILL vs ' +
        `FRAME_FILL/SHAPE_FILL scopes). ${report.passingNormalCount} of ${report.totalPairs} pair(s) meet WCAG AA ` +
        'for normal text (4.5:1).',
    );
    if (report.failingLargeCount > failing.length) {
      notes.push(
        `Showing the ${failing.length} lowest-contrast of ${report.failingLargeCount} failing pairs.`,
      );
    }
    return joinSections([
      mdHeading(3, 'Color Contrast'),
      mdList(notes),
      mdHeading(4, 'Pairs Failing AA Large (below 3:1)'),
      failing.length > 0
        ? contrastPairsTable(failing)
        : '_Every inferred foreground/background pair meets at least AA Large contrast (3:1)._\n',
    ]);
  }

  notes.unshift(
    'No foreground/background roles could be inferred from token names or scopes, so every opaque ' +
      `color token (${report.totalColorTokensChecked}) was checked against pure white and pure black instead.`,
  );
  return joinSections([
    mdHeading(3, 'Color Contrast'),
    mdList(notes),
    mdHeading(4, 'All Tokens vs. White / Black'),
    fallbackChecksTable(report.fallbackChecks),
  ]);
}

export function accessibilitySection(ds: DesignSystem): string {
  const smallTextStyles = ds.styles.text.filter(
    (s) => (s.textProperties?.fontSize ?? 0) > 0 && (s.textProperties?.fontSize ?? 100) < 12,
  );
  const undocumentedColors = [
    ...ds.variables.filter((v) => v.category === 'color' && !v.description),
    ...ds.styles.color.filter((s) => !s.description),
  ];

  const notes: string[] = [
    'This section lists deterministic, rule-based checks only — no AI is involved. The Color Contrast ' +
      'subsection below computes real WCAG 2.1 contrast ratios from token color values.',
  ];
  if (smallTextStyles.length > 0) {
    notes.push(
      `${smallTextStyles.length} text style(s) are set below 12px, which may fail legibility guidelines: ${smallTextStyles
        .map((s) => s.name)
        .join(', ')}.`,
    );
  }
  if (undocumentedColors.length > 0) {
    notes.push(
      `${undocumentedColors.length} color token(s) have no description — consider documenting intended usage and contrast pairing.`,
    );
  }
  notes.push(
    'Contrast ratios are computed only for token pairs (or white/black substitutes) inferred from naming ' +
      '— always confirm against the actual foreground/background combinations used in your UI before shipping.',
  );

  return joinSections([
    mdHeading(2, 'Accessibility Notes'),
    mdList(notes),
    colorContrastSection(ds),
  ]);
}
