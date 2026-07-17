export interface RGB {
  r: number;
  g: number;
  b: number;
}

function channelToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

export function relativeLuminance({ r, g, b }: RGB): number {
  const R = channelToLinear(r);
  const G = channelToLinear(g);
  const B = channelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function paintToRgb(paint: Paint): RGB | null {
  if (paint.type !== "SOLID" || paint.visible === false) return null;
  const { r, g, b } = paint.color;
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/** Flattens overlapping solid fills onto white using their opacity, approximating rendered color. */
export function compositeOnBackground(paints: readonly Paint[], background: RGB): RGB {
  let result = background;
  for (const paint of paints) {
    const rgb = paintToRgb(paint);
    if (!rgb) continue;
    const alpha = paint.opacity ?? 1;
    result = {
      r: rgb.r * alpha + result.r * (1 - alpha),
      g: rgb.g * alpha + result.g * (1 - alpha),
      b: rgb.b * alpha + result.b * (1 - alpha)
    };
  }
  return result;
}

export type WcagLevel = "AA" | "AAA";

export interface ContrastRequirement {
  normalText: number;
  largeText: number;
  uiComponent: number;
}

export const WCAG_THRESHOLDS: Record<WcagLevel, ContrastRequirement> = {
  AA: { normalText: 4.5, largeText: 3, uiComponent: 3 },
  AAA: { normalText: 7, largeText: 4.5, uiComponent: 3 }
};

export function isLargeText(fontSize: number, fontWeight: number): boolean {
  return fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
}

export function findFirstSolidFill(node: SceneNode): RGB | null {
  if (!("fills" in node)) return null;
  const fills = node.fills;
  if (fills === figma.mixed || !Array.isArray(fills)) return null;
  for (const paint of fills) {
    const rgb = paintToRgb(paint as Paint);
    if (rgb) return rgb;
  }
  return null;
}

/** Walks up the ancestor chain to find the nearest opaque background color. */
export function findAncestorBackground(node: SceneNode): RGB {
  let current: BaseNode | null = node.parent;
  while (current) {
    if ("fills" in current) {
      const fills = (current as unknown as MinimalFillsMixin).fills;
      if (Array.isArray(fills)) {
        for (const paint of fills as Paint[]) {
          if (paint.type === "SOLID" && paint.visible !== false && (paint.opacity ?? 1) >= 0.99) {
            return paintToRgb(paint) ?? { r: 255, g: 255, b: 255 };
          }
        }
      }
    }
    current = current.parent;
  }
  return { r: 255, g: 255, b: 255 };
}
