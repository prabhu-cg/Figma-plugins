import { processInBatches, safely } from '../utils/async';
import { collectBoundVariableIds } from './styles';
import type { RawComponent, RawComponentProperty, RawComponentVariant } from './rawTypes';

const COMPONENT_BATCH_SIZE = 100;
/** Bound to avoid pathological cost scanning huge component subtrees for bound variables. */
const MAX_DESCENDANTS_SCANNED = 60;
const MAX_DESCENDANT_DEPTH = 4;

function findPageName(node: BaseNode): string {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === 'PAGE') return current.name;
    current = current.parent;
  }
  return 'Unknown Page';
}

function scanDescendantBoundVariableIds(node: SceneNode): string[] {
  const ids = new Set<string>();
  let scanned = 0;

  const visit = (n: SceneNode, depth: number) => {
    if (scanned >= MAX_DESCENDANTS_SCANNED || depth > MAX_DESCENDANT_DEPTH) return;
    scanned++;
    const bound = (n as unknown as { boundVariables?: unknown }).boundVariables;
    collectBoundVariableIds(bound).forEach((id) => ids.add(id));
    if ('children' in n) {
      for (const child of (n as unknown as { children: SceneNode[] }).children) {
        if (scanned >= MAX_DESCENDANTS_SCANNED) break;
        visit(child, depth + 1);
      }
    }
  };

  visit(node, 0);
  return Array.from(ids);
}

function mapPropertyDefinitions(
  defs: ComponentPropertyDefinitions | undefined,
): RawComponentProperty[] {
  if (!defs) return [];
  return Object.entries(defs).map(([name, def]) => ({
    name,
    type: def.type,
    defaultValue: String(def.defaultValue ?? ''),
    variantOptions: def.variantOptions,
  }));
}

function mapVariant(node: ComponentNode): RawComponentVariant {
  return {
    id: node.id,
    name: node.name,
    description: node.description ?? '',
    variantProperties: node.variantProperties ?? {},
    boundVariableIds: scanDescendantBoundVariableIds(node),
  };
}

export async function extractComponents(
  onProgress?: (done: number, total: number) => void,
  onWarning?: (message: string) => void,
): Promise<RawComponent[]> {
  const warn = onWarning ?? (() => {});

  await safely(
    () => figma.loadAllPagesAsync(),
    (err) => warn(`Failed to load all pages for component scan: ${String(err)}`),
  );

  const nodes = await safely(
    () =>
      Promise.resolve(figma.root.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })),
    (err) => warn(`Failed to scan document for components: ${String(err)}`),
  );

  const allNodes = nodes ?? [];
  const componentSets = allNodes.filter((n): n is ComponentSetNode => n.type === 'COMPONENT_SET');
  const standaloneComponents = allNodes.filter(
    (n): n is ComponentNode => n.type === 'COMPONENT' && n.parent?.type !== 'COMPONENT_SET',
  );

  const fromSets = await processInBatches(
    componentSets,
    COMPONENT_BATCH_SIZE,
    (set): RawComponent => {
      const variantMembers = set.children.filter((c): c is ComponentNode => c.type === 'COMPONENT');
      return {
        id: set.id,
        key: set.key ?? set.id,
        name: set.name,
        description: set.description ?? '',
        isComponentSet: true,
        pageName: findPageName(set),
        properties: mapPropertyDefinitions(set.componentPropertyDefinitions),
        variants: variantMembers.map(mapVariant),
        boundVariableIds: Array.from(
          new Set(variantMembers.flatMap((v) => scanDescendantBoundVariableIds(v))),
        ),
      };
    },
    onProgress,
  );

  const fromStandalone = await processInBatches(
    standaloneComponents,
    COMPONENT_BATCH_SIZE,
    (node): RawComponent => ({
      id: node.id,
      key: node.key ?? node.id,
      name: node.name,
      description: node.description ?? '',
      isComponentSet: false,
      pageName: findPageName(node),
      properties: mapPropertyDefinitions(node.componentPropertyDefinitions),
      variants: [mapVariant(node)],
      boundVariableIds: scanDescendantBoundVariableIds(node),
    }),
    onProgress,
  );

  return [...fromSets, ...fromStandalone];
}
