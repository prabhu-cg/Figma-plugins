export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: RgbColor, b: RgbColor): number {
  const la = relativeLuminance(a.r, a.g, a.b);
  const lb = relativeLuminance(b.r, b.g, b.b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return parseFloat(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function meetsWCAG_AA(ratio: number): boolean {
  return ratio >= 4.5;
}

export function meetsWCAG_AAA(ratio: number): boolean {
  return ratio >= 7.0;
}

export function contrastOnWhite(rgb: RgbColor): number {
  return contrastRatio(rgb, { r: 255, g: 255, b: 255 });
}

export function contrastOnBlack(rgb: RgbColor): number {
  return contrastRatio(rgb, { r: 0, g: 0, b: 0 });
}
