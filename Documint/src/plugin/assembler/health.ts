import type {
  HealthSchema, HealthWarning, FoundationsSchema, ComponentsSchema,
  NamingPatterns, HealthBreakdown,
} from '@/types/schemas';

export function detectNamingPatterns(tokenNames: string[]): NamingPatterns {
  if (tokenNames.length === 0) {
    return { detected: [], consistent: true, recommendation: 'No tokens found' };
  }

  const separators = new Set<string>();
  for (const name of tokenNames) {
    if (name.includes('/'))           separators.add('slash-separated');
    else if (name.includes('.'))      separators.add('dot-separated');
    else if (name.includes(' '))      separators.add('space-separated');
    else if (/[a-z][A-Z]/.test(name)) separators.add('camelCase');
    else if (/^[A-Z][a-z]/.test(name)) separators.add('PascalCase');
  }

  const detected = Array.from(separators);
  const consistent = detected.length <= 1;
  const recommendation = consistent
    ? 'Naming convention is consistent'
    : `Mixed conventions detected (${detected.join(', ')}). Standardize on ${detected[0]} for predictable token lookup.`;

  return { detected, consistent, recommendation };
}

export function generateWarnings(
  _foundations: FoundationsSchema,
  components: ComponentsSchema
): HealthWarning[] {
  const warnings: HealthWarning[] = [];

  for (const comp of components.components) {
    if (!comp.description) {
      warnings.push({
        severity: 'warning', domain: 'components',
        itemId: comp.id, itemName: comp.name,
        code: 'MISSING_DESCRIPTION',
        message: `${comp.name} has no description`,
        suggestion: 'Add a description in the Figma component properties panel',
      });
    }

    if (comp.states.length === 0) {
      warnings.push({
        severity: 'info', domain: 'components',
        itemId: comp.id, itemName: comp.name,
        code: 'NO_STATES',
        message: `${comp.name} has no interactive states defined`,
        suggestion: 'Add a "State" property to component variants (e.g. default, hover, disabled)',
      });
    }

    const hasVariants = comp.variantGroups.some(g => g.type === 'variant');
    if (!hasVariants && comp.states.length === 0) {
      warnings.push({
        severity: 'info', domain: 'components',
        itemId: comp.id, itemName: comp.name,
        code: 'NO_VARIANTS',
        message: `${comp.name} has no variant properties`,
        suggestion: 'Consider adding Size, Type, or Style variant properties',
      });
    }
  }

  return warnings;
}

function scoreFoundations(foundations: FoundationsSchema): number {
  const total = foundations.colors.length + foundations.typography.length;
  if (total === 0) return 0;
  const scored = foundations.colors.filter(c => c.semanticRole !== 'unknown').length +
                 foundations.typography.filter(t => t.role !== 'unknown').length;
  return Math.round((scored / total) * 100);
}

function scoreComponents(components: ComponentsSchema): number {
  if (components.components.length === 0) return 0;
  let points = 0;
  const maxPerComp = 12; // 5 (description) + 3 (≥2 states) + 4 (bindings)
  for (const comp of components.components) {
    if (comp.description) points += 5;
    if (comp.states.length >= 2) points += 3;
    const hasBindings = comp.tokenBindings.colors.length > 0 || comp.tokenBindings.typography.length > 0;
    if (hasBindings) points += 4;
  }
  return Math.round((points / (components.components.length * maxPerComp)) * 100);
}

function scoreTokenCoverage(components: ComponentsSchema): number {
  if (components.components.length === 0) return 0;
  const withBindings = components.components.filter(
    c => c.tokenBindings.colors.length > 0 || c.tokenBindings.typography.length > 0
  ).length;
  return Math.round((withBindings / components.components.length) * 100);
}

export function assembleHealth(
  foundations: FoundationsSchema,
  components: ComponentsSchema,
  extraWarnings: HealthWarning[] = []
): HealthSchema {
  const allTokenNames = [
    ...foundations.colors.map(c => c.tokenName),
    ...foundations.typography.map(t => t.tokenName),
    ...foundations.spacing.map(s => s.tokenName),
  ];
  const namingPatterns = detectNamingPatterns(allTokenNames);
  const namingConsistencyScore = allTokenNames.length === 0 ? 0 :
    namingPatterns.consistent ? 100 : namingPatterns.detected.length === 2 ? 70 : 30;

  const foundationsScore = scoreFoundations(foundations);
  const componentsScore = scoreComponents(components);
  const tokenCoverageScore = scoreTokenCoverage(components);

  const breakdown: HealthBreakdown = {
    foundationsScore, componentsScore, tokenCoverageScore, namingConsistencyScore,
  };

  const overallScore = Math.round(
    foundationsScore * 0.3 +
    componentsScore * 0.3 +
    tokenCoverageScore * 0.2 +
    namingConsistencyScore * 0.2
  );

  return {
    overallScore,
    breakdown,
    warnings: [...generateWarnings(foundations, components), ...extraWarnings],
    missingFields: [],
    namingPatterns,
  };
}
