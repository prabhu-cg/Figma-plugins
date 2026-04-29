import { relativeLuminance, contrastRatio, meetsWCAG_AA, meetsWCAG_AAA } from '@/plugin/inference/wcag';

describe('relativeLuminance', () => {
  it('returns 1 for white (255, 255, 255)', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 4);
  });

  it('returns 0 for black (0, 0, 0)', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0.0, 4);
  });

  it('returns ~0.2126 for pure red (255, 0, 0)', () => {
    expect(relativeLuminance(255, 0, 0)).toBeCloseTo(0.2126, 3);
  });
});

describe('contrastRatio', () => {
  it('returns ~21 for black on white', () => {
    const ratio = contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 });
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('returns 1 for identical colors', () => {
    const ratio = contrastRatio({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 });
    expect(ratio).toBeCloseTo(1, 4);
  });

  it('is commutative — same result regardless of order', () => {
    const a = { r: 59, g: 130, b: 246 };
    const b = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 4);
  });
});

describe('meetsWCAG_AA', () => {
  it('returns true for ratio >= 4.5', () => {
    expect(meetsWCAG_AA(4.5)).toBe(true);
    expect(meetsWCAG_AA(7.0)).toBe(true);
  });

  it('returns false for ratio < 4.5', () => {
    expect(meetsWCAG_AA(4.49)).toBe(false);
    expect(meetsWCAG_AA(2.0)).toBe(false);
  });
});

describe('meetsWCAG_AAA', () => {
  it('returns true for ratio >= 7.0', () => {
    expect(meetsWCAG_AAA(7.0)).toBe(true);
    expect(meetsWCAG_AAA(21.0)).toBe(true);
  });

  it('returns false for ratio < 7.0', () => {
    expect(meetsWCAG_AAA(6.99)).toBe(false);
  });
});
