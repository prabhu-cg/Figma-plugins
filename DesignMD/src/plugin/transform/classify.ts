import type { TokenCategory, VariableResolvedType } from '@shared/types';

const SPACING_HINTS = ['spacing', 'space', 'gap', 'padding', 'margin', 'radius', 'size', 'sizing'];
const TYPOGRAPHY_HINTS = ['font', 'typography', 'type', 'line-height', 'letter-spacing', 'text'];
const SEMANTIC_HINTS = ['semantic'];
const COMPONENT_HINTS = ['component'];

function nameHasHint(name: string, hints: string[]): boolean {
  const lower = name.toLowerCase();
  return hints.some((hint) => lower.includes(hint));
}

/**
 * Infers a TokenCategory bucket from a variable's name/path and resolved
 * type. Figma doesn't expose an explicit "this is a spacing token" flag, so
 * this heuristic — resolved type first, then naming conventions — is the
 * deterministic stand-in every generator relies on for grouping.
 */
export function classifyVariable(
  fullName: string,
  resolvedType: VariableResolvedType,
  scopes: string[],
): TokenCategory {
  if (nameHasHint(fullName, SEMANTIC_HINTS)) return 'semantic';
  if (nameHasHint(fullName, COMPONENT_HINTS)) return 'component';

  if (resolvedType === 'COLOR') return 'color';
  if (resolvedType === 'BOOLEAN') return 'boolean';

  if (resolvedType === 'FLOAT') {
    const typographyScopes = ['FONT_SIZE', 'LINE_HEIGHT', 'LETTER_SPACING', 'PARAGRAPH_SPACING'];
    if (scopes.some((s) => typographyScopes.includes(s))) return 'typography';
    if (nameHasHint(fullName, TYPOGRAPHY_HINTS)) return 'typography';
    if (scopes.includes('GAP') || nameHasHint(fullName, SPACING_HINTS)) return 'spacing';
    return 'number';
  }

  if (resolvedType === 'STRING') {
    if (nameHasHint(fullName, TYPOGRAPHY_HINTS)) return 'typography';
    return 'string';
  }

  return 'other';
}
