import { processInBatches, safely } from '../utils/async';
import { boundVariablesOf } from './styles';
import type { RawComponent, RawComponentProperty, RawComponentVariant } from './rawTypes';

const COMPONENT_BATCH_SIZE = 100;
/** Bound to avoid pathological cost scanning huge component subtrees for bound variables. */
const MAX_DESCENDANTS_SCANNED = 500;
const MAX_DESCENDANT_DEPTH = 10;

/** Node properties that hold the id of an applied local/library style. */
const STYLE_ID_KEYS = [
  'textStyleId',
  'fillStyleId',
  'strokeStyleId',
  'effectStyleId',
  'gridStyleId',
] as const;

function findPageName(node: BaseNode): string {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === 'PAGE') return current.name;
    current = current.parent;
  }
  return 'Unknown Page';
}

/** Minimal shape needed to walk an ancestor chain, kept duck-typed so this is unit-testable without a Figma runtime. */
export interface NamedAncestor {
  name: string;
  type: string;
  parent: NamedAncestor | null;
}

/**
 * Mirrors Figma's own "hide from publishing" convention: a component, style, frame,
 * section, or page whose name starts with "." is excluded from the library, and that
 * exclusion cascades to everything nested inside it. Checked up to and including the
 * containing page — the document root's name (the file name) is never treated as a hide signal.
 */
export function isHiddenFromPublishing(node: NamedAncestor): boolean {
  let current: NamedAncestor | null = node;
  while (current) {
    if (current.name.trim().startsWith('.')) return true;
    if (current.type === 'PAGE') return false;
    current = current.parent;
  }
  return false;
}

interface NodeBindings {
  variableIds: string[];
  styleIds: string[];
  /** True when the subtree was larger than the scan budget, so usage may be under-reported. */
  truncated: boolean;
}

function readStyleIds(n: SceneNode, into: Set<string>): void {
  for (const key of STYLE_ID_KEYS) {
    try {
      const value = (n as unknown as Record<string, unknown>)[key];
      // figma.mixed is a symbol; an unstyled node is ''.
      if (typeof value === 'string' && value !== '') into.add(value);
    } catch {
      // Some node types throw on style-id access — nothing to record.
    }
  }
}

/** Collects variable ids bound directly on a subtree, plus the styles it applies (resolved later). */
function scanNodeBindings(node: SceneNode): NodeBindings {
  const variableIds = new Set<string>();
  const styleIds = new Set<string>();
  let scanned = 0;
  let truncated = false;

  const visit = (n: SceneNode, depth: number) => {
    if (scanned >= MAX_DESCENDANTS_SCANNED || depth > MAX_DESCENDANT_DEPTH) {
      truncated = true;
      return;
    }
    scanned++;
    boundVariablesOf(n).forEach((id) => variableIds.add(id));
    readStyleIds(n, styleIds);
    if ('children' in n) {
      for (const child of (n as unknown as { children: SceneNode[] }).children) {
        visit(child, depth + 1);
      }
    }
  };

  visit(node, 0);
  return { variableIds: Array.from(variableIds), styleIds: Array.from(styleIds), truncated };
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

function mapVariant(node: ComponentNode): { variant: RawComponentVariant; bindings: NodeBindings } {
  const bindings = scanNodeBindings(node);
  return {
    variant: {
      id: node.id,
      name: node.name,
      description: node.description ?? '',
      variantProperties: node.variantProperties ?? {},
      boundVariableIds: bindings.variableIds,
    },
    bindings,
  };
}

function unionOf(lists: string[][]): string[] {
  return Array.from(new Set(lists.flat()));
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
  const componentSetsAll = allNodes.filter(
    (n): n is ComponentSetNode => n.type === 'COMPONENT_SET',
  );
  const standaloneComponentsAll = allNodes.filter(
    (n): n is ComponentNode => n.type === 'COMPONENT' && n.parent?.type !== 'COMPONENT_SET',
  );

  const componentSets = componentSetsAll.filter((n) => !isHiddenFromPublishing(n));
  const standaloneComponents = standaloneComponentsAll.filter((n) => !isHiddenFromPublishing(n));

  const hiddenCount =
    componentSetsAll.length -
    componentSets.length +
    (standaloneComponentsAll.length - standaloneComponents.length);
  if (hiddenCount > 0) {
    warn(
      `Skipped ${hiddenCount} component(s)/component set(s) hidden from publishing ` +
        '(name, or an ancestor frame/section/page, starts with ".").',
    );
  }

  let truncatedCount = 0;

  const fromSets = await processInBatches(
    componentSets,
    COMPONENT_BATCH_SIZE,
    (set): RawComponent => {
      const variantMembers = set.children.filter((c): c is ComponentNode => c.type === 'COMPONENT');
      const mapped = variantMembers.map(mapVariant);
      if (mapped.some((m) => m.bindings.truncated)) truncatedCount++;
      return {
        id: set.id,
        key: set.key ?? set.id,
        name: set.name,
        description: set.description ?? '',
        isComponentSet: true,
        pageName: findPageName(set),
        properties: mapPropertyDefinitions(set.componentPropertyDefinitions),
        variants: mapped.map((m) => m.variant),
        boundVariableIds: unionOf(mapped.map((m) => m.bindings.variableIds)),
        styleIds: unionOf(mapped.map((m) => m.bindings.styleIds)),
      };
    },
    onProgress,
  );

  const fromStandalone = await processInBatches(
    standaloneComponents,
    COMPONENT_BATCH_SIZE,
    (node): RawComponent => {
      const { variant, bindings } = mapVariant(node);
      if (bindings.truncated) truncatedCount++;
      return {
        id: node.id,
        key: node.key ?? node.id,
        name: node.name,
        description: node.description ?? '',
        isComponentSet: false,
        pageName: findPageName(node),
        properties: mapPropertyDefinitions(node.componentPropertyDefinitions),
        variants: [variant],
        boundVariableIds: bindings.variableIds,
        styleIds: bindings.styleIds,
      };
    },
    onProgress,
  );

  if (truncatedCount > 0) {
    warn(
      `${truncatedCount} component(s) are larger than the scan budget (${MAX_DESCENDANTS_SCANNED} layers, ` +
        `${MAX_DESCENDANT_DEPTH} levels deep), so their token usage may be under-reported.`,
    );
  }

  return [...fromSets, ...fromStandalone];
}
