function toByte(channel: number): number {
  return Math.round(Math.min(1, Math.max(0, channel)) * 255);
}

export function rgbToHex(color: { r: number; g: number; b: number; a?: number }): string {
  const r = toByte(color.r).toString(16).padStart(2, "0");
  const g = toByte(color.g).toString(16).padStart(2, "0");
  const b = toByte(color.b).toString(16).padStart(2, "0");
  if (color.a !== undefined && color.a < 1) {
    const a = toByte(color.a).toString(16).padStart(2, "0");
    return `#${r}${g}${b}${a}`.toUpperCase();
  }
  return `#${r}${g}${b}`.toUpperCase();
}
