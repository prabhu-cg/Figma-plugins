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

/**
 * Flattens solid fills onto a background. Figma lists paints bottom-to-top, so compositing in
 * array order matches how they render. `extraOpacity` carries layer/ancestor opacity.
 */
export function compositeOnBackground(paints: readonly Paint[], background: RGB, extraOpacity = 1): RGB {
  let result = background;
  for (const paint of paints) {
    const rgb = paintToRgb(paint);
    if (!rgb) continue;
    const alpha = (paint.opacity ?? 1) * extraOpacity;
    result = {
      r: rgb.r * alpha + result.r * (1 - alpha),
      g: rgb.g * alpha + result.g * (1 - alpha),
      b: rgb.b * alpha + result.b * (1 - alpha)
    };
  }
  return result;
}

/** Product of the node's and its ancestors' layer opacity (0-1). */
export function effectiveOpacity(node: BaseNode): number {
  let opacity = 1;
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    if ("opacity" in current && typeof (current as SceneNode & BlendMixin).opacity === "number") {
      opacity *= (current as SceneNode & BlendMixin).opacity;
    }
    current = current.parent;
  }
  return opacity;
}

export type { WcagLevel } from "@shared/types";
import type { WcagLevel } from "@shared/types";

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

/** The topmost visible solid fill (Figma lists paints bottom-to-top), or null if none. */
export function findTopSolidFill(node: SceneNode): RGB | null {
  if (!("fills" in node)) return null;
  const fills = node.fills;
  if (fills === figma.mixed || !Array.isArray(fills)) return null;
  for (let i = fills.length - 1; i >= 0; i--) {
    const rgb = paintToRgb(fills[i] as Paint);
    if (rgb) return rgb;
  }
  return null;
}

/** Topmost visible solid stroke, for outline-style icons. */
export function findTopSolidStroke(node: SceneNode): RGB | null {
  if (!("strokes" in node)) return null;
  const strokes = node.strokes as readonly Paint[];
  for (let i = strokes.length - 1; i >= 0; i--) {
    const rgb = paintToRgb(strokes[i]);
    if (rgb) return rgb;
  }
  return null;
}

/**
 * Resolves the color behind `node` by walking up ancestors. Semi-transparent fills are
 * composited over whatever lies beneath them. Returns null when the backdrop can't be
 * determined (a gradient or image fill sits behind the node), so callers skip rather than
 * guess. Hidden ancestors are ignored. Falls back to white at the canvas.
 */
export function findAncestorBackground(node: SceneNode): RGB | null {
  // Innermost-first; each entry holds the translucent paints (bottom-to-top) laid over what's below.
  const layers: { paints: Paint[]; opacity: number }[] = [];
  let base: RGB | null = null;
  let current: BaseNode | null = node.parent;
  while (current && !base) {
    const hidden = "visible" in current && (current as SceneNode).visible === false;
    if (!hidden && "fills" in current) {
      const fills = (current as unknown as MinimalFillsMixin).fills;
      if (Array.isArray(fills)) {
        const opacity = "opacity" in current ? (current as unknown as BlendMixin).opacity : 1;
        const paints: Paint[] = [];
        for (let k = fills.length - 1; k >= 0 && !base; k--) {
          const paint = fills[k] as Paint;
          if (paint.visible === false) continue;
          if (paint.type !== "SOLID") return null; // gradient/image backdrop: can't resolve to one color
          if ((paint.opacity ?? 1) * opacity >= 0.99) base = paintToRgb(paint);
          else paints.unshift(paint);
        }
        if (paints.length > 0) layers.push({ paints, opacity });
      }
    }
    current = current.parent;
  }
  let color: RGB = base ?? { r: 255, g: 255, b: 255 };
  for (let k = layers.length - 1; k >= 0; k--) {
    color = compositeOnBackground(layers[k].paints, color, layers[k].opacity);
  }
  return color;
}
