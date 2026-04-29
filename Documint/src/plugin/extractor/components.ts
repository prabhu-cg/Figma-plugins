import type { RawComponentNode, RawVariantNode } from '@/types/raw';

export interface ComponentExtractionResult {
  components: RawComponentNode[];
  variantsByComponentId: Record<string, RawVariantNode[]>;
}

function toRawVariant(v: any): RawVariantNode {
  return {
    id: v.id as string,
    name: v.name as string,
    componentProperties: v.componentProperties ?? {},
    children: v.children ?? [],
    fills: v.fills ?? [],
    strokes: v.strokes ?? [],
    effects: v.effects ?? [],
    fillStyleId: v.fillStyleId ?? '',
    textStyleId: v.textStyleId ?? '',
    effectStyleId: v.effectStyleId ?? '',
  };
}

function toRawComponent(node: any): RawComponentNode {
  return {
    id: node.id as string,
    name: node.name as string,
    description: node.description ?? '',
    componentPropertyDefinitions: node.componentPropertyDefinitions ?? {},
    children: node.children ?? [],
    fills: node.fills ?? [],
    strokes: node.strokes ?? [],
    effects: node.effects ?? [],
    fillStyleId: node.fillStyleId ?? '',
    strokeStyleId: node.strokeStyleId ?? '',
    textStyleId: node.textStyleId ?? '',
    effectStyleId: node.effectStyleId ?? '',
    boundVariables: node.boundVariables ?? {},
  };
}

export function extractComponents(selection: readonly any[]): ComponentExtractionResult {
  const components: RawComponentNode[] = [];
  const variantsByComponentId: Record<string, RawVariantNode[]> = {};

  for (const node of selection) {
    if (node.type === 'COMPONENT_SET') {
      components.push(toRawComponent(node));
      variantsByComponentId[node.id] = (node.children as any[] ?? [])
        .filter((c: any) => c.type === 'COMPONENT')
        .map(toRawVariant);

    } else if (node.type === 'COMPONENT') {
      components.push(toRawComponent(node));
      variantsByComponentId[node.id] = [];
    }
  }

  return { components, variantsByComponentId };
}
