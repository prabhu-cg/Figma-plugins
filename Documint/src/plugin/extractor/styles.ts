import type { RawColorStyle, RawTextStyle, RawEffectStyle, RawGridStyle } from '@/types/raw';

export function extractColorStyles(): RawColorStyle[] {
  return (figma.getLocalPaintStyles() as any[]).map((s: any) => ({
    id: s.id as string,
    name: s.name as string,
    paints: s.paints,
  }));
}

export function extractTextStyles(): RawTextStyle[] {
  return (figma.getLocalTextStyles() as any[]).map((s: any) => ({
    id: s.id as string,
    name: s.name as string,
    fontName: s.fontName,
    fontSize: s.fontSize as number,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textCase: s.textCase,
    textDecoration: s.textDecoration,
  }));
}

export function extractEffectStyles(): RawEffectStyle[] {
  return (figma.getLocalEffectStyles() as any[]).map((s: any) => ({
    id: s.id as string,
    name: s.name as string,
    effects: s.effects,
  }));
}

export function extractGridStyles(): RawGridStyle[] {
  return (figma.getLocalGridStyles() as any[]).map((s: any) => ({
    id: s.id as string,
    name: s.name as string,
    grids: s.grids,
  }));
}
