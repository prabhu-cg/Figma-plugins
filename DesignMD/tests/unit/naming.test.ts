import { describe, expect, it } from 'vitest';
import {
  fontWeightFromStyle,
  kebabCase,
  nameHasHint,
  nameSegments,
  rgbaToHex,
  toCssVarName,
  toFileSafeName,
  toPathSegments,
} from '../../src/shared/naming';

describe('toPathSegments', () => {
  it('splits on slash and trims whitespace', () => {
    expect(toPathSegments('Color / Primary / 500')).toEqual(['Color', 'Primary', '500']);
  });

  it('drops empty segments from leading/trailing/double slashes', () => {
    expect(toPathSegments('/Color//Primary/')).toEqual(['Color', 'Primary']);
  });

  it('returns a single segment for names with no slash', () => {
    expect(toPathSegments('Spacing md')).toEqual(['Spacing md']);
  });
});

describe('kebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(kebabCase('fontSize')).toBe('font-size');
  });

  it('converts spaces and underscores to hyphens', () => {
    expect(kebabCase('Primary 500')).toBe('primary-500');
    expect(kebabCase('primary_500')).toBe('primary-500');
  });

  it('strips illegal characters', () => {
    expect(kebabCase('Primary!! 500??')).toBe('primary-500');
  });

  it('collapses repeated hyphens and trims edges', () => {
    expect(kebabCase('--Primary--500--')).toBe('primary-500');
  });
});

describe('toCssVarName', () => {
  it('builds a -- prefixed custom property name from path segments', () => {
    expect(toCssVarName(['Color', 'Primary', '500'])).toBe('--color-primary-500');
  });

  it('handles a single segment', () => {
    expect(toCssVarName(['Radius'])).toBe('--radius');
  });
});

describe('toFileSafeName', () => {
  it('strips filesystem-unsafe characters', () => {
    expect(toFileSafeName('Button/Icon: Large')).toBe('ButtonIconLarge');
  });

  it('title-cases words separated by spaces', () => {
    expect(toFileSafeName('primary button')).toBe('PrimaryButton');
  });
});

describe('rgbaToHex', () => {
  it('converts opaque RGB floats to a 6-digit hex string', () => {
    expect(rgbaToHex(1, 0, 0, 1)).toBe('#ff0000');
  });

  it('appends an alpha byte when alpha is less than 1', () => {
    expect(rgbaToHex(1, 1, 1, 0.5)).toBe('#ffffff80');
  });

  it('clamps out-of-range values', () => {
    expect(rgbaToHex(2, -1, 0.5, 1)).toBe('#ff0080');
  });
});

describe('fontWeightFromStyle', () => {
  it.each([
    ['Regular', 400],
    ['Bold', 700],
    ['Semi Bold Italic', 600],
    ['SemiBold', 600],
    ['Extra Bold', 800],
    ['Light', 300],
    ['Extra Light', 200],
    ['Medium', 500],
    ['Black', 900],
    ['Thin', 100],
  ])('maps "%s" to %i', (style, weight) => {
    expect(fontWeightFromStyle(style)).toBe(weight);
  });
});

describe('toFileSafeName edge cases', () => {
  it('never returns an empty name or a hidden/dot-only name', () => {
    expect(toFileSafeName('???')).toBe('Component');
    expect(toFileSafeName('..')).toBe('Component');
    expect(toFileSafeName('.hidden')).toBe('Hidden');
  });
});

describe('nameSegments / nameHasHint', () => {
  it('splits on separators and camelCase', () => {
    expect(nameSegments('fontSize/Base_2')).toEqual(['font', 'size', 'base', '2']);
  });

  it('matches whole segments, not substrings', () => {
    expect(nameHasHint('button-bg', ['on'])).toBe(false);
    expect(nameHasHint('on-primary', ['on'])).toBe(true);
    expect(nameHasHint('prototype/value', ['type'])).toBe(false);
  });

  it('allows a plural and matches multi-word hints on consecutive segments', () => {
    expect(nameHasHint('Sizes/md', ['size'])).toBe(true);
    expect(nameHasHint('lineHeight/tight', ['line-height'])).toBe(true);
    expect(nameHasHint('line/other-height', ['line-height'])).toBe(false);
  });
});
