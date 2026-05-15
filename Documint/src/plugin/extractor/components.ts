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
    // Layout properties
    layoutMode: v.layoutMode,
    itemSpacing: v.itemSpacing,
    paddingTop: v.paddingTop,
    paddingRight: v.paddingRight,
    paddingBottom: v.paddingBottom,
    paddingLeft: v.paddingLeft,
    constraints: v.constraints,
    width: v.width,
    height: v.height,
    cornerRadius: v.cornerRadius,
    topLeftRadius: v.topLeftRadius,
    topRightRadius: v.topRightRadius,
    bottomLeftRadius: v.bottomLeftRadius,
    bottomRightRadius: v.bottomRightRadius,
    opacity: v.opacity,
    blendMode: v.blendMode,
    primaryAxisAlignItems: v.primaryAxisAlignItems,
    primaryAxisSizingMode: v.primaryAxisSizingMode,
  };
}

function getPageName(node: any, providedPageName?: string): string {
  // Use provided page name if available (from full-system extraction)
  if (providedPageName) {
    return providedPageName;
  }
  // Fallback to traversing the parent chain
  let current = node;
  while (current && current.parent) {
    current = current.parent;
    if (current.type === 'PAGE') {
      return current.name;
    }
  }
  return '';
}

function toRawComponent(node: any, providedPageName?: string): RawComponentNode {
  const resolvedPageName = getPageName(node, providedPageName);
  const result: RawComponentNode = {
    id: node.id as string,
    name: node.name as string,
    description: node.description ?? '',
    pageName: resolvedPageName,
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

  // Debug first few components
  if ((result.name === 'Activity' || result.name === 'Airplay')) {
    console.log(`toRawComponent: ${result.name}, provided="${providedPageName}", resolved="${resolvedPageName}", result.pageName="${result.pageName}"`);
  }

  return result;
}

export function extractComponents(selection: readonly any[], componentIdToPageName?: Record<string, string>): ComponentExtractionResult {
  const components: RawComponentNode[] = [];
  const variantsByComponentId: Record<string, RawVariantNode[]> = {};
  const processed = new Set<string>();

  // Debug: log the page name map
  if (componentIdToPageName && Object.keys(componentIdToPageName).length > 0) {
    const sampleEntries = Object.entries(componentIdToPageName).slice(0, 5);
    console.log('extractComponents - componentIdToPageName map size:', Object.keys(componentIdToPageName).length);
    console.log('extractComponents - sample entries:', sampleEntries.map(([id, name]) => `${id.slice(0, 8)}...="${name}"`));
  } else {
    console.log('extractComponents - componentIdToPageName is empty or undefined');
  }

  // Debug: log selection info
  console.log('extractComponents - selection size:', selection.length);

  function processNode(node: any, isVariantChild: boolean = false): void {
    if (!node || processed.has(node.id)) return;

    if (node.type === 'COMPONENT_SET') {
      processed.add(node.id);
      const pageName = componentIdToPageName?.[node.id];
      if (components.length < 3) {
        console.log(`COMPONENT_SET: ${node.name}, id=${node.id}, pageName from map="${pageName}"`);
      }
      components.push(toRawComponent(node, pageName));
      variantsByComponentId[node.id] = (node.children as any[] ?? [])
        .filter((c: any) => c.type === 'COMPONENT')
        .map(toRawVariant);
      // Don't recurse into component set children - they're variants, not standalone components

    } else if (node.type === 'COMPONENT' && !isVariantChild) {
      // Only process COMPONENT if it's not a variant child
      processed.add(node.id);
      const pageName = componentIdToPageName?.[node.id];
      components.push(toRawComponent(node, pageName));
      variantsByComponentId[node.id] = [];
      // Don't recurse into component children - they're part of this component's internal structure,
      // not separate documentable components

    } else if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') {
      // For non-component nodes (frames, groups, etc), recurse to find nested components
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          processNode(child, false);
        }
      }
    }
  }

  for (const node of selection) {
    processNode(node);
  }

  return { components, variantsByComponentId };
}
