import type {
  ComponentInputLike,
  ComponentPropertyDefinitionLike,
  ComponentVariantLike,
  EffectLike,
  NodeLike,
  PaintLike,
} from "@plugin/scanner/types";
import type {
  ComponentPropertySnapshot,
  ComponentSnapshot,
  EffectSnapshot,
  LayoutSnapshot,
  NodeStructureSnapshot,
  PaintSnapshot,
  StyleBindingSnapshot,
  TokenBindingSnapshot,
  TypographySnapshot,
  VariantSnapshot,
} from "@shared/types/component";
import { hashObject } from "@shared/utils/hash";

function isMixed(value: unknown): boolean {
  return typeof value === "symbol";
}

function normalizePaint(paint: PaintLike): PaintSnapshot {
  return {
    type: paint.type,
    color: paint.color
      ? `${Math.round(paint.color.r * 255)},${Math.round(paint.color.g * 255)},${Math.round(paint.color.b * 255)}`
      : undefined,
    opacity: paint.opacity,
    visible: paint.visible ?? true,
    boundVariableId: paint.boundVariables?.color?.id,
  };
}

function normalizeEffect(effect: EffectLike): EffectSnapshot {
  return {
    type: effect.type,
    visible: effect.visible ?? true,
    radius: effect.radius,
    color: effect.color
      ? `${Math.round(effect.color.r * 255)},${Math.round(effect.color.g * 255)},${Math.round(effect.color.b * 255)},${effect.color.a ?? 1}`
      : undefined,
    offsetX: effect.offset?.x,
    offsetY: effect.offset?.y,
  };
}

function normalizeLayout(node: NodeLike): LayoutSnapshot | undefined {
  if (!node.layoutMode || node.layoutMode === "NONE") return undefined;
  return {
    mode: node.layoutMode,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
    itemSpacing: node.itemSpacing,
    primaryAxisAlign: node.primaryAxisAlignItems,
    counterAxisAlign: node.counterAxisAlignItems,
    primaryAxisSizing: node.primaryAxisSizingMode,
    counterAxisSizing: node.counterAxisSizingMode,
  };
}

function normalizeTypography(node: NodeLike): TypographySnapshot | undefined {
  if (node.type !== "TEXT") return undefined;
  const boundVariableIds: Record<string, string> = {};
  const bound = node.boundVariables ?? {};
  for (const field of ["fontFamily", "fontSize", "lineHeight", "letterSpacing"]) {
    const entry = bound[field];
    if (entry && !Array.isArray(entry)) boundVariableIds[field] = entry.id;
  }
  const fontName = !isMixed(node.fontName) ? (node.fontName as { family: string; style: string } | undefined) : undefined;
  const lineHeight = !isMixed(node.lineHeight)
    ? (node.lineHeight as { value: number; unit: string } | { unit: "AUTO" } | undefined)
    : undefined;
  const letterSpacing = !isMixed(node.letterSpacing)
    ? (node.letterSpacing as { value: number; unit: string } | undefined)
    : undefined;
  return {
    fontFamily: fontName?.family,
    fontStyle: fontName?.style,
    fontSize: !isMixed(node.fontSize) ? (node.fontSize as number | undefined) : undefined,
    lineHeight: lineHeight ? ("value" in lineHeight ? `${lineHeight.value}${lineHeight.unit}` : "AUTO") : undefined,
    letterSpacing: letterSpacing ? `${letterSpacing.value}${letterSpacing.unit}` : undefined,
    boundVariableIds: Object.keys(boundVariableIds).length > 0 ? boundVariableIds : undefined,
  };
}

function extractTokenBindings(node: NodeLike): TokenBindingSnapshot[] {
  const bound = node.boundVariables ?? {};
  const bindings: TokenBindingSnapshot[] = [];
  for (const [field, entry] of Object.entries(bound)) {
    if (!entry) continue;
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => {
        bindings.push({ field: `${field}[${index}]`, variableId: item.id });
      });
    } else {
      bindings.push({ field, variableId: entry.id });
    }
  }
  return bindings.sort((a, b) => a.field.localeCompare(b.field));
}

function extractStyleBindings(node: NodeLike): StyleBindingSnapshot[] {
  const bindings: StyleBindingSnapshot[] = [];
  if (node.fillStyleId) bindings.push({ field: "fills", styleId: node.fillStyleId, styleType: "PAINT" });
  if (node.strokeStyleId) bindings.push({ field: "strokes", styleId: node.strokeStyleId, styleType: "PAINT" });
  if (node.effectStyleId) bindings.push({ field: "effects", styleId: node.effectStyleId, styleType: "EFFECT" });
  if (node.textStyleId) bindings.push({ field: "text", styleId: node.textStyleId, styleType: "TEXT" });
  return bindings;
}

function normalizeNode(node: NodeLike, keyPrefix: string, index: number): NodeStructureSnapshot {
  const key = `${keyPrefix}/${index}:${node.name}`;
  return {
    key,
    name: node.name,
    type: node.type,
    visible: node.visible ?? true,
    width: node.width,
    height: node.height,
    cornerRadius: !isMixed(node.cornerRadius) ? (node.cornerRadius as number | undefined) : undefined,
    fills: !isMixed(node.fills) ? (node.fills as PaintLike[] | undefined)?.map(normalizePaint) : undefined,
    strokes: node.strokes?.map(normalizePaint),
    effects: node.effects?.map(normalizeEffect),
    layout: normalizeLayout(node),
    typography: normalizeTypography(node),
    tokenBindings: extractTokenBindings(node),
    styleBindings: extractStyleBindings(node),
    children: (node.children ?? []).map((child, childIndex) => normalizeNode(child, key, childIndex)),
  };
}

function normalizeProperty(name: string, def: ComponentPropertyDefinitionLike): ComponentPropertySnapshot {
  return {
    name,
    type: def.type,
    defaultValue: def.defaultValue ?? null,
    variantOptions: def.variantOptions,
    preferredValues: def.preferredValues,
    boundVariableId: def.boundVariables?.id,
  };
}

function normalizeVariant(variant: ComponentVariantLike): VariantSnapshot {
  return {
    name: variant.name,
    properties: variant.variantProperties ?? {},
  };
}

export function normalizeComponent(input: ComponentInputLike): ComponentSnapshot {
  const properties: ComponentPropertySnapshot[] = Object.entries(
    input.componentPropertyDefinitions ?? {},
  )
    .map(([rawName, def]) => normalizeProperty(rawName.split("#")[0] ?? rawName, def))
    .sort((a, b) => a.name.localeCompare(b.name));

  const variants: VariantSnapshot[] = [...input.variants]
    .map(normalizeVariant)
    .sort((a, b) => a.name.localeCompare(b.name));

  const structure = normalizeNode(input.representative, "root", 0);

  const snapshot: Omit<ComponentSnapshot, "hash"> = {
    identity: {
      id: input.id,
      key: input.key,
      name: input.name,
      componentSetId: input.componentSetId,
      componentSetName: input.componentSetName,
      remote: input.remote,
    },
    metadata: {
      description: input.description,
      documentationLink: input.documentationLinks?.[0]?.uri,
    },
    properties,
    variants,
    structure,
    tokens: structure.tokenBindings ?? [],
    styles: structure.styleBindings ?? [],
    dimensions: {
      width: input.representative.width,
      height: input.representative.height,
    },
    layout: normalizeLayout(input.representative),
    capturedAt: new Date().toISOString(),
  };

  const hash = hashObject({ ...snapshot, capturedAt: undefined });

  return { ...snapshot, hash };
}
