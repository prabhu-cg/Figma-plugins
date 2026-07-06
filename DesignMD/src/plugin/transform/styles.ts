import { rgbaToHex, toCssVarName, toPathSegments } from '@shared/naming';
import type { StyleToken } from '@shared/types';
import type {
  RawEffectStyle,
  RawGridStyle,
  RawPaintStyle,
  RawTextStyle,
} from '../extraction/rawTypes';

export function transformTextStyles(raw: RawTextStyle[]): StyleToken[] {
  return raw.map((s) => {
    const path = toPathSegments(s.name);
    return {
      id: s.id,
      name: s.name,
      path,
      type: 'TEXT',
      description: s.description,
      cssName: toCssVarName(path),
      textProperties: {
        fontFamily: s.fontFamily,
        fontStyle: s.fontStyle,
        fontWeight: s.fontWeight,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        textCase: s.textCase,
        textDecoration: s.textDecoration,
        paragraphSpacing: s.paragraphSpacing,
      },
    };
  });
}

export function transformPaintStyles(raw: RawPaintStyle[]): StyleToken[] {
  return raw.map((s) => {
    const path = toPathSegments(s.name);
    return {
      id: s.id,
      name: s.name,
      path,
      type: 'PAINT',
      description: s.description,
      cssName: toCssVarName(path),
      paint: s.color
        ? { ...s.color, hex: rgbaToHex(s.color.r, s.color.g, s.color.b, s.color.a) }
        : undefined,
      paintIsGradientOrImage: s.isGradientOrImage,
    };
  });
}

export function transformEffectStyles(raw: RawEffectStyle[]): StyleToken[] {
  return raw.map((s) => {
    const path = toPathSegments(s.name);
    return {
      id: s.id,
      name: s.name,
      path,
      type: 'EFFECT',
      description: s.description,
      cssName: toCssVarName(path),
      effects: s.effects.map((e) => ({
        type: e.type,
        color: e.color
          ? { ...e.color, hex: rgbaToHex(e.color.r, e.color.g, e.color.b, e.color.a) }
          : undefined,
        offsetX: e.offsetX,
        offsetY: e.offsetY,
        radius: e.radius,
        spread: e.spread,
        visible: e.visible,
      })),
    };
  });
}

export function transformGridStyles(raw: RawGridStyle[]): StyleToken[] {
  return raw.map((s) => {
    const path = toPathSegments(s.name);
    return {
      id: s.id,
      name: s.name,
      path,
      type: 'GRID',
      description: s.description,
      cssName: toCssVarName(path),
      grids: s.grids.map((g) => ({ ...g })),
    };
  });
}
