import type { AnatomyRole, ComponentCategory, AccessibilityRole } from '@/types/schemas';

// ─── Anatomy ──────────────────────────────────────────────────────────────────

interface AnatomyRule { keywords: string[]; role: AnatomyRole }

const ANATOMY_RULES: AnatomyRule[] = [
  { keywords: ['icon', 'leading-icon', 'trailing-icon'],                role: 'icon' },
  { keywords: ['label', 'text', 'title', 'caption'],                    role: 'text' },
  { keywords: ['container', 'background', 'fill', 'wrapper', 'frame'],  role: 'container' },
  { keywords: ['indicator', 'dot', 'badge', 'chip'],                    role: 'indicator' },
  { keywords: ['image', 'thumbnail', 'avatar', 'media', 'photo'],       role: 'media' },
];

export function inferAnatomyRole(layerName: string): AnatomyRole {
  const lower = layerName.toLowerCase();
  for (const { keywords, role } of ANATOMY_RULES) {
    if (keywords.some(kw => lower.includes(kw))) return role;
  }
  return 'unknown';
}

// ─── Component Category ───────────────────────────────────────────────────────

const ATOM_KEYWORDS    = ['button', 'input', 'checkbox', 'radio', 'icon', 'badge', 'tag', 'chip', 'avatar', 'tooltip', 'toggle', 'switch'];
const MOLECULE_KEYWORDS = ['card', 'form', 'field', 'search', 'dropdown', 'select', 'menu', 'list', 'item', 'row', 'tab'];
const ORGANISM_KEYWORDS = ['header', 'footer', 'nav', 'navigation', 'sidebar', 'modal', 'dialog', 'table', 'banner', 'hero'];

export function inferComponentCategory(name: string): ComponentCategory {
  const lower = name.toLowerCase();
  if (ATOM_KEYWORDS.some(kw => lower.includes(kw)))     return 'atom';
  if (MOLECULE_KEYWORDS.some(kw => lower.includes(kw))) return 'molecule';
  if (ORGANISM_KEYWORDS.some(kw => lower.includes(kw))) return 'organism';
  return 'unknown';
}

// ─── Accessibility ────────────────────────────────────────────────────────────

const A11Y_ROLE_MAP: Array<[string, AccessibilityRole]> = [
  ['button', 'button'], ['btn', 'button'],
  ['link', 'link'],     ['anchor', 'link'],
  ['input', 'input'],   ['textfield', 'input'], ['textarea', 'input'],
  ['checkbox', 'checkbox'],
  ['radio', 'radio'],
  ['listitem', 'listitem'], ['item', 'listitem'],
];

export function inferAccessibilityRole(name: string): AccessibilityRole {
  const lower = name.toLowerCase();
  for (const [kw, role] of A11Y_ROLE_MAP) {
    if (lower.includes(kw)) return role;
  }
  return 'unknown';
}

export function inferKeyboardInteraction(role: AccessibilityRole): string {
  const map: Record<AccessibilityRole, string> = {
    button:   'Enter or Space to activate',
    link:     'Enter to navigate',
    input:    'Type to enter text; Tab to move focus',
    checkbox: 'Space to toggle',
    radio:    'Arrow keys to select between options',
    listitem: 'Arrow keys to navigate; Enter to select',
    unknown:  'Tab to focus',
  };
  return map[role];
}

export function inferAriaAttributes(role: AccessibilityRole, states: string[]): string[] {
  const attrs: string[] = [];
  if (states.includes('disabled'))                        attrs.push('aria-disabled');
  if (role === 'button' && states.includes('pressed'))    attrs.push('aria-pressed');
  if (role === 'checkbox')                                attrs.push('aria-checked');
  if (role === 'input')                                   attrs.push('aria-required', 'aria-invalid');
  return attrs;
}
