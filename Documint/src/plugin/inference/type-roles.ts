import type { TypographyRole } from '@/types/schemas';

interface TypographyRule {
  keywords: string[];
  role: TypographyRole;
}

const TYPE_RULES: TypographyRule[] = [
  { keywords: ['display', 'hero'],                                   role: 'display' },
  { keywords: ['h1', 'heading-1', 'heading1'],                       role: 'h1' },
  { keywords: ['h2', 'heading-2', 'heading2'],                       role: 'h2' },
  { keywords: ['h3', 'heading-3', 'heading3'],                       role: 'h3' },
  { keywords: ['h4', 'heading-4', 'heading4'],                       role: 'h4' },
  { keywords: ['h5', 'heading-5', 'heading5'],                       role: 'h5' },
  { keywords: ['h6', 'heading-6', 'heading6'],                       role: 'h6' },
  { keywords: ['body-lg', 'body-large', 'bodylarge'],                role: 'body-lg' },
  { keywords: ['body-sm', 'body-small', 'bodysmall'],                role: 'body-sm' },
  { keywords: ['body', 'paragraph'],                                 role: 'body-md' },
  { keywords: ['caption', 'helper', 'hint'],                         role: 'caption' },
  { keywords: ['label', 'tag'],                                      role: 'label' },
  { keywords: ['code', 'mono', 'monospace'],                         role: 'code' },
  { keywords: ['overline', 'eyebrow'],                               role: 'overline' },
];

export function inferTypographyRole(tokenName: string): TypographyRole {
  const lower = tokenName.toLowerCase();
  for (const { keywords, role } of TYPE_RULES) {
    if (keywords.some(kw => lower.includes(kw))) return role;
  }
  return 'unknown';
}
