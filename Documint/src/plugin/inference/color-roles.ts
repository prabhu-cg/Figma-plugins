import type { SemanticColorRole } from '@/types/schemas';

type RoleKeywords = Record<Exclude<SemanticColorRole, 'unknown'>, string[]>;

const ROLE_KEYWORDS: RoleKeywords = {
  primary:    ['primary', 'brand', 'main', 'key'],
  secondary:  ['secondary', 'accent'],
  success:    ['success', 'positive', 'confirm'],
  warning:    ['warning', 'caution', 'alert'],
  error:      ['error', 'danger', 'destructive'],
  neutral:    ['neutral', 'gray', 'grey', 'slate'],
  surface:    ['surface', 'background', 'bg', 'canvas'],
  'on-surface': ['on-surface', 'foreground', 'fg', 'text'],
};

const COLOR_NAME_TO_ROLE: Record<string, SemanticColorRole> = {
  red:    'error',
  green:  'success',
  yellow: 'warning',
  blue:   'primary',
  white:  'surface',
  black:  'on-surface',
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

export function inferColorRole(tokenName: string): SemanticColorRole {
  const lower = tokenName.toLowerCase();

  // First, check for exact keyword matches (including compound keywords like "on-surface")
  // Sort keywords by length (longest first) to prioritize more specific matches
  const allKeywords = Object.entries(ROLE_KEYWORDS).flatMap(([role, kws]) =>
    kws.map(kw => ({ role: role as SemanticColorRole, keyword: kw }))
  ).sort((a, b) => b.keyword.length - a.keyword.length);

  for (const { role, keyword } of allKeywords) {
    // Check for exact match as a complete token or segment
    const escaped = escapeRegExp(keyword);
    if (new RegExp(`(?:^|[/-])${escaped}(?:[/-]|$)`).test(lower)) return role;
  }

  // Split by common separators to get individual tokens
  const tokens = lower.split(/[/-]/);

  // Check each token
  for (const token of tokens) {
    for (const [role, keywords] of Object.entries(ROLE_KEYWORDS) as [SemanticColorRole, string[]][]) {
      if (keywords.includes(token)) return role;
    }

    for (const [colorName, role] of Object.entries(COLOR_NAME_TO_ROLE)) {
      if (colorName === token) return role;
    }
  }

  // Fallback to substring matching (for cases like "brand-blue")
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS) as [SemanticColorRole, string[]][]) {
    if (keywords.some(kw => lower.includes(kw))) return role;
  }

  for (const [colorName, role] of Object.entries(COLOR_NAME_TO_ROLE)) {
    if (lower.includes(colorName)) return role;
  }

  return 'unknown';
}
