import type { EffectLike, NodeLike, PaintLike } from "./types";

// Figma's SceneNode is a large polymorphic union; DSLog only reads a fixed
// subset of fields per node kind. Narrow `any` casts here are the pragmatic
// alternative to re-deriving Figma's own mixin types field by field.
/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_DEPTH = 32;

function adaptPaints(paints: unknown): PaintLike[] | undefined {
  if (typeof paints === "symbol") return undefined;
  if (!Array.isArray(paints)) return undefined;
  return paints.map((p: any) => ({
    type: p.type,
    visible: p.visible,
    opacity: p.opacity,
    color: p.color,
    boundVariables: p.boundVariables,
  }));
}

function adaptEffects(effects: unknown): EffectLike[] | undefined {
  if (!Array.isArray(effects)) return undefined;
  return effects.map((e: any) => ({
    type: e.type,
    visible: e.visible,
    radius: e.radius,
    color: e.color,
    offset: e.offset,
  }));
}

export function adaptNode(node: any, depth = 0): NodeLike {
  const result: NodeLike = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: "visible" in node ? node.visible : true,
  };

  if ("width" in node) result.width = node.width;
  if ("height" in node) result.height = node.height;
  if ("cornerRadius" in node) result.cornerRadius = node.cornerRadius;
  if ("fills" in node) result.fills = adaptPaints(node.fills);
  if ("strokes" in node) result.strokes = adaptPaints(node.strokes);
  if ("effects" in node) result.effects = adaptEffects(node.effects);

  if ("layoutMode" in node) {
    result.layoutMode = node.layoutMode;
    result.paddingTop = node.paddingTop;
    result.paddingRight = node.paddingRight;
    result.paddingBottom = node.paddingBottom;
    result.paddingLeft = node.paddingLeft;
    result.itemSpacing = node.itemSpacing;
    result.primaryAxisAlignItems = node.primaryAxisAlignItems;
    result.counterAxisAlignItems = node.counterAxisAlignItems;
    result.primaryAxisSizingMode = node.primaryAxisSizingMode;
    result.counterAxisSizingMode = node.counterAxisSizingMode;
  }

  if (node.type === "TEXT") {
    result.fontName = node.fontName;
    result.fontSize = node.fontSize;
    result.lineHeight = node.lineHeight;
    result.letterSpacing = node.letterSpacing;
  }

  if ("fillStyleId" in node && node.fillStyleId) result.fillStyleId = node.fillStyleId;
  if ("strokeStyleId" in node && node.strokeStyleId) result.strokeStyleId = node.strokeStyleId;
  if ("effectStyleId" in node && node.effectStyleId) result.effectStyleId = node.effectStyleId;
  if ("textStyleId" in node && node.textStyleId) result.textStyleId = node.textStyleId;
  if ("boundVariables" in node && node.boundVariables) result.boundVariables = node.boundVariables;

  if ("children" in node && depth < MAX_DEPTH) {
    result.children = (node.children as any[]).map((child) => adaptNode(child, depth + 1));
  }

  return result;
}
