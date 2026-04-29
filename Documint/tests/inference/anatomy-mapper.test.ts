import { inferAnatomyRole, inferComponentCategory, inferAccessibilityRole, inferKeyboardInteraction, inferAriaAttributes } from '@/plugin/inference/anatomy-mapper';

describe('inferAnatomyRole', () => {
  it.each([
    ['icon', 'icon'],
    ['leading-icon', 'icon'],
    ['trailing-icon', 'icon'],
    ['Icon', 'icon'],
    ['label', 'text'],
    ['text', 'text'],
    ['title', 'text'],
    ['caption', 'text'],
    ['container', 'container'],
    ['background', 'container'],
    ['fill', 'container'],
    ['wrapper', 'container'],
    ['indicator', 'indicator'],
    ['dot', 'indicator'],
    ['badge', 'indicator'],
    ['image', 'media'],
    ['avatar', 'media'],
    ['thumbnail', 'media'],
    ['random-layer-xyz', 'unknown'],
  ] as [string, string][])(
    '"%s" → role "%s"',
    (layerName, expectedRole) => {
      expect(inferAnatomyRole(layerName)).toBe(expectedRole);
    }
  );
});

describe('inferComponentCategory', () => {
  it.each([
    ['Button', 'atom'],
    ['Input', 'atom'],
    ['Checkbox', 'atom'],
    ['Icon', 'atom'],
    ['Badge', 'atom'],
    ['Card', 'molecule'],
    ['FormField', 'molecule'],
    ['DropdownMenu', 'molecule'],
    ['Header', 'organism'],
    ['NavigationBar', 'organism'],
    ['Modal', 'organism'],
    ['RandomComponent', 'unknown'],
  ] as [string, string][])(
    '"%s" → category "%s"',
    (name, expectedCategory) => {
      expect(inferComponentCategory(name)).toBe(expectedCategory);
    }
  );
});

describe('inferAccessibilityRole', () => {
  it('infers button role', () => {
    expect(inferAccessibilityRole('Button')).toBe('button');
    expect(inferAccessibilityRole('IconButton')).toBe('button');
  });

  it('infers input role', () => {
    expect(inferAccessibilityRole('TextInput')).toBe('input');
    expect(inferAccessibilityRole('TextField')).toBe('input');
  });

  it('infers checkbox role', () => {
    expect(inferAccessibilityRole('Checkbox')).toBe('checkbox');
  });

  it('falls back to unknown', () => {
    expect(inferAccessibilityRole('SomethingRandom')).toBe('unknown');
  });
});

describe('inferKeyboardInteraction', () => {
  it('returns Enter or Space for button', () => {
    expect(inferKeyboardInteraction('button')).toContain('Enter');
  });

  it('returns a non-empty string for all known roles', () => {
    const roles = ['button', 'link', 'input', 'checkbox', 'radio', 'listitem', 'unknown'] as const;
    roles.forEach(role => {
      expect(inferKeyboardInteraction(role).length).toBeGreaterThan(0);
    });
  });
});

describe('inferAriaAttributes', () => {
  it('adds aria-disabled when disabled state present', () => {
    expect(inferAriaAttributes('button', ['default', 'disabled'])).toContain('aria-disabled');
  });

  it('adds aria-checked for checkbox', () => {
    expect(inferAriaAttributes('checkbox', [])).toContain('aria-checked');
  });

  it('returns empty array when no states match', () => {
    expect(inferAriaAttributes('unknown', [])).toEqual([]);
  });
});
