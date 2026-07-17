import type { ComponentInfo, VariantInfo } from "@shared/types";
import type { ComponentRecord } from "../rules/types";
import { detectComponentKind, detectStatesFromVariants, EXPECTED_STATES } from "./componentTaxonomy";

export interface CollectResult {
  components: ComponentRecord[];
  variables: Variable[];
  variableCollections: VariableCollection[];
  paintStyles: PaintStyle[];
  textStyles: TextStyle[];
  effectStyles: EffectStyle[];
  gridStyles: GridStyle[];
  allComponentNodes: SceneNode[];
  totalLayers: number;
  instanceCounts: Map<string, number>;
  variantInstanceCounts: Map<string, number>;
}

const DEPRECATED_PATTERN = /deprecated|legacy|do not use|obsolete|\[old\]/i;

function isDeprecatedMarker(text: string): boolean {
  if (!text) return false;
  return DEPRECATED_PATTERN.test(text) || text.trim().startsWith("🚫") || text.trim().startsWith("⚠️ deprecated");
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function variantPropsToDict(props: { [key: string]: string } | null): Record<string, string> {
  return props ? { ...props } : {};
}

function buildComponentSetRecord(set: ComponentSetNode, page: PageNode): ComponentRecord {
  const variantNodes = set.children.filter((c): c is ComponentNode => c.type === "COMPONENT");
  const variants: VariantInfo[] = variantNodes.map((v) => ({
    id: v.id,
    name: v.name,
    properties: variantPropsToDict(v.variantProperties)
  }));
  const propertyDefinitions = Object.keys(set.componentPropertyDefinitions ?? {});
  const allPropValues = variantNodes.flatMap((v) => Object.values(v.variantProperties ?? {}));
  const kind = detectComponentKind(set.name);
  const detectedStates = detectStatesFromVariants(allPropValues);
  const expected = EXPECTED_STATES[kind] ?? [];
  const missingStates = expected.filter((s) => !detectedStates.includes(s));
  const description = set.description ?? "";

  const info: ComponentInfo = {
    id: set.id,
    name: set.name,
    type: "COMPONENT_SET",
    pageId: page.id,
    pageName: page.name,
    description,
    variantCount: variantNodes.length,
    variants,
    propertyDefinitions,
    isDeprecated: isDeprecatedMarker(set.name) || isDeprecatedMarker(description),
    hasDocumentation: description.trim().length > 0,
    detectedKind: kind,
    detectedStates,
    missingStates
  };

  return { node: set, info, variantNodes: variantNodes.length > 0 ? variantNodes : [] };
}

function buildStandaloneComponentRecord(node: ComponentNode, page: PageNode): ComponentRecord {
  const kind = detectComponentKind(node.name);
  const expected = EXPECTED_STATES[kind] ?? [];
  const description = node.description ?? "";

  const info: ComponentInfo = {
    id: node.id,
    name: node.name,
    type: "COMPONENT",
    pageId: page.id,
    pageName: page.name,
    description,
    variantCount: 1,
    variants: [],
    propertyDefinitions: Object.keys(node.componentPropertyDefinitions ?? {}),
    isDeprecated: isDeprecatedMarker(node.name) || isDeprecatedMarker(description),
    hasDocumentation: description.trim().length > 0,
    detectedKind: kind,
    detectedStates: [],
    missingStates: expected
  };

  return { node, info, variantNodes: [node] };
}

export async function collectDocument(
  onProgress: (phase: string, processed: number, total: number) => void,
  isCancelled: () => boolean
): Promise<CollectResult> {
  await figma.loadAllPagesAsync();
  const pages = figma.root.children;
  const components: ComponentRecord[] = [];
  const instanceCounts = new Map<string, number>();
  const variantInstanceCounts = new Map<string, number>();
  let totalLayers = 0;

  for (let p = 0; p < pages.length; p++) {
    if (isCancelled()) break;
    const page = pages[p];
    onProgress("Scanning pages", p + 1, pages.length);

    const nodes = page.findAll(() => true);
    totalLayers += nodes.length;

    for (const node of nodes) {
      if (node.type === "COMPONENT_SET") {
        components.push(buildComponentSetRecord(node as ComponentSetNode, page));
      } else if (node.type === "COMPONENT" && node.parent?.type !== "COMPONENT_SET") {
        components.push(buildStandaloneComponentRecord(node as ComponentNode, page));
      } else if (node.type === "INSTANCE") {
        try {
          const main = (node as InstanceNode).mainComponent;
          if (main) {
            const rollupKey = main.parent?.type === "COMPONENT_SET" ? main.parent.id : main.id;
            instanceCounts.set(rollupKey, (instanceCounts.get(rollupKey) ?? 0) + 1);
            variantInstanceCounts.set(main.id, (variantInstanceCounts.get(main.id) ?? 0) + 1);
          }
        } catch {
          // Main component not resolvable (e.g. from an unpublished library); skip.
        }
      }
    }
    await tick();
  }

  const allComponentNodes: SceneNode[] = [];
  for (let i = 0; i < components.length; i++) {
    if (isCancelled()) break;
    if (i % 25 === 0) {
      onProgress("Indexing component layers", i + 1, components.length);
      await tick();
    }
    for (const variant of components[i].variantNodes) {
      allComponentNodes.push(variant, ...variant.findAll(() => true));
    }
  }

  onProgress("Reading variables and styles", 0, 1);
  const [variables, variableCollections, paintStyles, textStyles, effectStyles, gridStyles] = await Promise.all([
    figma.variables.getLocalVariablesAsync(),
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
    figma.getLocalGridStylesAsync()
  ]);

  return {
    components,
    variables,
    variableCollections,
    paintStyles,
    textStyles,
    effectStyles,
    gridStyles,
    allComponentNodes,
    totalLayers,
    instanceCounts,
    variantInstanceCounts
  };
}
