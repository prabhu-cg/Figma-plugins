import { describe, expect, it } from 'vitest';
import {
  kebabCase,
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
