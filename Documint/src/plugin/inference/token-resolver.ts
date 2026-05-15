import type { TokenBinding } from '../documentation-engine/types';

// ─── Token Name Normalization ────────────────────────────────────────────

export function normalizeTokenName(raw: string): string {
  if (!raw) return '';

  // Already normalized (contains dots)
  if (raw.includes('.') && !raw.includes('/') && !raw.includes('-')) {
    return raw;
  }

  // Convert slashes to dots
  let normalized = raw.replace(/\//g, '.');

  // Convert dashes to dots if it looks like a scale token (spacing-16 → spacing.16)
  if (/^[a-z]+[-][a-zA-Z0-9]+/.test(normalized)) {
    normalized = normalized.replace(/-/g, '.');
  }

  return normalized.toLowerCase();
}

// ─── Token Tier Classification ──────────────────────────────────────────

export function classifyTokenTier(tokenName: string, _collectionName?: string): 1 | 2 | 3 {
  const normalized = normalizeTokenName(tokenName);
  const segments = normalized.split('.');

  // Tier 1: Primitive/Base tokens
  // Indicators: numeric suffix (blue.500, spacing.16), scale-like naming
  const lastSegment = segments[segments.length - 1] || '';
  if (/^\d+$/.test(lastSegment)) {
    return 1; // Has numeric scale suffix
  }

  // Tier 2: Semantic tokens
  // Indicators: semantic keywords (primary, secondary, error, surface, success, warning, neutral)
  const semanticKeywords = [
    'primary',
    'secondary',
    'error',
    'success',
    'warning',
    'danger',
    'info',
    'neutral',
    'surface',
    'default',
    'accent',
  ];
  if (semanticKeywords.some((kw) => normalized.includes(kw))) {
    return 2;
  }

  // Tier 3: Component tokens
  // Indicators: 3+ segments (button.primary.background) or component name in collection
  if (segments.length >= 3) {
    return 3;
  }

  // Default to Tier 2 if no clear indicator
  return 2;
}

// ─── Token Resolution ───────────────────────────────────────────────────

export interface TokenTableRow {
  element: string; // e.g. "fill", "padding"
  alias: string; // variable name (e.g. "color/primary")
  normalized: string; // normalized (e.g. "color.primary")
  tier: 1 | 2 | 3;
  resolvedValue: string; // hex, px, or "—"
  fallback: string; // fallback value or "—"
}

export function buildTokenTableRows(
  bindings: TokenBinding[],
  colorVariables: any[] = [],
  spacingVariables: any[] = []
): TokenTableRow[] {
  const rows: TokenTableRow[] = [];

  // Build lookup maps
  const colorVarMap = new Map<string, any>(colorVariables.map((v) => [v.id, v]));
  const spacingVarMap = new Map<string, any>(spacingVariables.map((v) => [v.id, v]));

  bindings.forEach((binding) => {
    const varId = binding.value;

    // Try to resolve in color variables
    const colorVar = colorVarMap.get(varId);
    if (colorVar) {
      const normalized = normalizeTokenName(colorVar.name);
      const tier = classifyTokenTier(colorVar.name, colorVar.collectionName);
      rows.push({
        element: binding.element,
        alias: colorVar.name,
        normalized,
        tier,
        resolvedValue: colorVar.resolvedType === 'COLOR' ? getColorValue(colorVar) : '—',
        fallback: '—',
      });
      return;
    }

    // Try to resolve in spacing variables
    const spacingVar = spacingVarMap.get(varId);
    if (spacingVar) {
      const normalized = normalizeTokenName(spacingVar.name);
      const tier = classifyTokenTier(spacingVar.name, spacingVar.collectionName);
      rows.push({
        element: binding.element,
        alias: spacingVar.name,
        normalized,
        tier,
        resolvedValue: spacingVar.resolvedType === 'FLOAT' ? `${spacingVar.valuesByMode?.default || spacingVar.value}px` : '—',
        fallback: '—',
      });
      return;
    }

    // Unresolved
    rows.push({
      element: binding.element,
      alias: `(unresolved: ${varId})`,
      normalized: '—',
      tier: 2,
      resolvedValue: '—',
      fallback: '—',
    });
  });

  return rows;
}

// ─── Helper: Extract color value ────────────────────────────────────────

function getColorValue(colorVar: any): string {
  // Try to get first mode value
  const modeValue = colorVar.valuesByMode?.default || colorVar.value;

  if (typeof modeValue === 'string' && modeValue.startsWith('#')) {
    return modeValue.toUpperCase();
  }

  if (typeof modeValue === 'object' && modeValue.r !== undefined) {
    const r = Math.round(modeValue.r * 255)
      .toString(16)
      .padStart(2, '0');
    const g = Math.round(modeValue.g * 255)
      .toString(16)
      .padStart(2, '0');
    const b = Math.round(modeValue.b * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }

  return '—';
}
