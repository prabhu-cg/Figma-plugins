import { describe, expect, it } from 'vitest';
import {
  transformEffectStyles,
  transformGridStyles,
  transformPaintStyles,
  transformTextStyles,
} from '../../src/plugin/transform/styles';
import { makeEffectStyle, makeGridStyle, makePaintStyle, makeTextStyle } from './fixtures';

describe('transformTextStyles', () => {
  it('maps font properties and builds a css name', () => {
    const [style] = transformTextStyles([makeTextStyle()]);
    expect(style.cssName).toBe('--heading-large');
    expect(style.textProperties).toMatchObject({ fontFamily: 'Inter', fontSize: 32 });
  });
});

describe('transformPaintStyles', () => {
  it('converts a solid paint to hex', () => {
    const [style] = transformPaintStyles([makePaintStyle()]);
    expect(style.paint?.hex).toBe('#ffffff');
    expect(style.paintIsGradientOrImage).toBe(false);
  });

  it('marks styles with no solid paint as gradient/image and omits paint', () => {
    const [style] = transformPaintStyles([
      makePaintStyle({ color: null, isGradientOrImage: true }),
    ]);
    expect(style.paint).toBeUndefined();
    expect(style.paintIsGradientOrImage).toBe(true);
  });
});

describe('transformEffectStyles', () => {
  it('carries through shadow effect properties', () => {
    const [style] = transformEffectStyles([makeEffectStyle()]);
    expect(style.effects?.[0]).toMatchObject({ type: 'DROP_SHADOW', radius: 8, visible: true });
    expect(style.effects?.[0].color?.hex).toBe('#00000033');
  });
});

describe('transformGridStyles', () => {
  it('carries through grid layout properties', () => {
    const [style] = transformGridStyles([makeGridStyle()]);
    expect(style.grids?.[0]).toMatchObject({ pattern: 'COLUMNS', count: 12, gutterSize: 16 });
  });
});
