import {
  createTimeSlicer,
  isCancelled,
  processInBatches,
  safely,
  yieldToEventLoop,
} from '../utils/async';
import { boundVariablesOf } from './styles';
import type { ComponentLayout } from '@shared/types';
import type { RawComponent, RawComponentProperty, RawComponentVariant } from './rawTypes';

/** Components per batch. Kept small: a batch's components are scanned side by side. */
const COMPONENT_BATCH_SIZE = 20;
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
async function scanNodeBindings(
  node: SceneNode,
  yieldIfDue: () => Promise<void>,
): Promise<NodeBindings> {
  const variableIds = new Set<string>();
  const styleIds = new Set<string>();
  let scanned = 0;
  let truncated = false;

  const visit = async (n: SceneNode, depth: number) => {
    if (scanned >= MAX_DESCENDANTS_SCANNED || depth > MAX_DESCENDANT_DEPTH) {
      truncated = true;
      return;
    }
    scanned++;
    // Each node costs several calls into Figma; hand control back often so the editor stays usable.
    await yieldIfDue();
    boundVariablesOf(n).forEach((id) => variableIds.add(id));
    readStyleIds(n, styleIds);
    if ('children' in n) {
      for (const child of (n as unknown as { children: SceneNode[] }).children) {
        await visit(child, depth + 1);
      }
    }
  };

  await visit(node, 0);
  return { variableIds: Array.from(variableIds), styleIds: Array.from(styleIds), truncated };
}

function numberProp(n: SceneNode, key: string): number | undefined {
  try {
    const value = (n as unknown as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Size, auto-layout, and corner radius of a component node (rounded; absent props are omitted). */
export function readLayout(node: ComponentNode): ComponentLayout | undefined {
  const width = numberProp(node, 'width');
  const height = numberProp(node, 'height');
  if (width === undefined || height === undefined) return undefined;

  const mode = (node as unknown as { layoutMode?: unknown }).layoutMode;
  const layoutMode = mode === 'HORIZONTAL' || mode === 'VERTICAL' ? mode : 'NONE';
  const layout: ComponentLayout = {
    measuredFrom: node.name,
    width: round(width),
    height: round(height),
    layoutMode,
  };

  if (layoutMode !== 'NONE') {
    const gap = numberProp(node, 'itemSpacing');
    if (gap !== undefined) layout.gap = round(gap);
    const [top, right, bottom, left] = [
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
    ].map((key) => numberProp(node, key));
    if ([top, right, bottom, left].every((p) => p !== undefined)) {
      layout.padding = {
        top: round(top!),
        right: round(right!),
        bottom: round(bottom!),
        left: round(left!),
      };
    }
  }

  // figma.mixed (differing corners) is a symbol, so numberProp skips it.
  const radius = numberProp(node, 'cornerRadius');
  if (radius !== undefined && radius > 0) layout.cornerRadius = round(radius);
  return layout;
}

/** Name of the component an INSTANCE_SWAP property defaults to (the definition only holds its id). */
async function resolveDefaultName(id: unknown): Promise<string | undefined> {
  if (typeof id !== 'string' || id === '') return undefined;
  try {
    const target = await figma.getNodeByIdAsync(id);
    if (!target) return undefined;
    // A variant is named "State=Default"; the set's name is the useful one.
    return target.parent?.type === 'COMPONENT_SET' ? target.parent.name : target.name;
  } catch {
    return undefined;
  }
}

async function mapPropertyDefinitions(
  defs: ComponentPropertyDefinitions | undefined,
): Promise<RawComponentProperty[]> {
  if (!defs) return [];
  return Promise.all(
    Object.entries(defs).map(async ([name, def]) => {
      const property: RawComponentProperty = {
        name,
        type: def.type,
        defaultValue: String(def.defaultValue ?? ''),
        variantOptions: def.variantOptions,
      };
      if (def.type === 'INSTANCE_SWAP') {
        const resolved = await resolveDefaultName(def.defaultValue);
        if (resolved) property.defaultResolvedName = resolved;
      }
      return property;
    }),
  );
}

async function mapVariant(
  node: ComponentNode,
  yieldIfDue: () => Promise<void>,
): Promise<{ variant: RawComponentVariant; bindings: NodeBindings }> {
  const bindings = await scanNodeBindings(node, yieldIfDue);
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

/** The set's default variant when Figma exposes it, otherwise the first one. */
export function defaultVariantOf(set: ComponentSetNode, members: ComponentNode[]): ComponentNode {
  const declared = (set as unknown as { defaultVariant?: ComponentNode }).defaultVariant;
  return declared && members.some((m) => m.id === declared.id) ? declared : members[0];
}

function unionOf(lists: string[][]): string[] {
  return Array.from(new Set(lists.flat()));
}

type ComponentLike = ComponentNode | ComponentSetNode;

const findComponentLike = (root: SceneNode | DocumentNode | PageNode): ComponentLike[] =>
  (root as ChildrenMixin).findAllWithCriteria({
    types: ['COMPONENT', 'COMPONENT_SET'],
  }) as ComponentLike[];

/**
 * Searches the document one page at a time. One search over the whole document is a single long
 * stretch of work on Figma's main thread (it froze the editor on big files); per page it is bounded
 * by the page, with a yield between pages, and one page that fails does not lose the others.
 */
async function findInDocument(
  warn: (message: string) => void,
  onPage?: (done: number, total: number, name: string) => void,
): Promise<ComponentLike[]> {
  const found: ComponentLike[] = [];
  const pages = figma.root.children;
  let loadedAll = false;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (isCancelled()) break;
    // Named before the work starts: if Figma stalls on a page, the last message says which one.
    onPage?.(i, pages.length, page.name);
    // Load one page at a time, so Figma gets a breath between pages. loadAllPagesAsync is one call
    // that cannot be interrupted, and locked the editor on a very large file.
    if (typeof page.loadAsync === 'function') {
      await safely(
        () => page.loadAsync(),
        (err) => warn(`Failed to load page "${page.name}": ${String(err)}`),
      );
    } else if (!loadedAll) {
      loadedAll = true;
      await safely(
        () => figma.loadAllPagesAsync(),
        (err) => warn(`Failed to load all pages for component scan: ${String(err)}`),
      );
    }
    const hits = await safely(
      () => Promise.resolve(findComponentLike(page)),
      (err) => warn(`Failed to scan page "${page.name}" for components: ${String(err)}`),
    );
    found.push(...(hits ?? []));
    await yieldToEventLoop();
  }
  onPage?.(pages.length, pages.length, '');
  return found;
}

/**
 * Components and component sets within the given layers: the layers themselves when they are
 * components, plus everything nested inside them. A selected variant stands for its whole set.
 */
function findComponentsWithin(
  roots: readonly SceneNode[],
): Array<ComponentNode | ComponentSetNode> {
  const found = new Map<string, ComponentNode | ComponentSetNode>();
  const add = (n: ComponentNode | ComponentSetNode) => {
    const target = n.type === 'COMPONENT' && n.parent?.type === 'COMPONENT_SET' ? n.parent : n;
    found.set(target.id, target as ComponentNode | ComponentSetNode);
  };
  for (const root of roots) {
    if (root.type === 'COMPONENT' || root.type === 'COMPONENT_SET') add(root);
    if ('findAllWithCriteria' in root) {
      for (const n of findComponentLike(root)) add(n);
    }
  }
  return Array.from(found.values());
}

/**
 * @param selection When given, only components inside these layers are extracted (the whole
 * document is scanned otherwise).
 */
export async function extractComponents(
  onProgress?: (done: number, total: number) => void,
  onWarning?: (message: string) => void,
  selection?: readonly SceneNode[],
  /** Reports each page as it is loaded and searched (whole-file scans only). */
  onPage?: (done: number, total: number, name: string) => void,
): Promise<RawComponent[]> {
  const warn = onWarning ?? (() => {});
  if (isCancelled()) return [];

  const nodes = selection
    ? await safely(
        () => Promise.resolve(findComponentsWithin(selection)),
        (err) => warn(`Failed to scan selection for components: ${String(err)}`),
      )
    : await findInDocument(warn, onPage);
  const yieldIfDue = createTimeSlicer();

  // Sorting thousands of nodes into sets and standalone components, and checking each one's
  // ancestors for a hidden name, is a long stretch of calls into Figma; slice it.
  const allNodes = nodes ?? [];
  const componentSetsAll: ComponentSetNode[] = [];
  const standaloneComponentsAll: ComponentNode[] = [];
  const componentSets: ComponentSetNode[] = [];
  const standaloneComponents: ComponentNode[] = [];
  for (const n of allNodes) {
    await yieldIfDue();
    if (n.type === 'COMPONENT_SET') {
      componentSetsAll.push(n);
      if (!isHiddenFromPublishing(n)) componentSets.push(n);
    } else if (n.type === 'COMPONENT' && n.parent?.type !== 'COMPONENT_SET') {
      standaloneComponentsAll.push(n);
      if (!isHiddenFromPublishing(n)) standaloneComponents.push(n);
    }
  }

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
    async (set): Promise<RawComponent> => {
      const variantMembers = set.children.filter((c): c is ComponentNode => c.type === 'COMPONENT');
      const mapped = await Promise.all(variantMembers.map((m) => mapVariant(m, yieldIfDue)));
      if (mapped.some((m) => m.bindings.truncated)) truncatedCount++;
      return {
        id: set.id,
        key: set.key ?? set.id,
        name: set.name,
        description: set.description ?? '',
        isComponentSet: true,
        pageName: findPageName(set),
        properties: await mapPropertyDefinitions(set.componentPropertyDefinitions),
        variants: mapped.map((m) => m.variant),
        layout:
          variantMembers.length > 0 ? readLayout(defaultVariantOf(set, variantMembers)) : undefined,
        boundVariableIds: unionOf(mapped.map((m) => m.bindings.variableIds)),
        styleIds: unionOf(mapped.map((m) => m.bindings.styleIds)),
      };
    },
    onProgress,
  );

  const fromStandalone = await processInBatches(
    standaloneComponents,
    COMPONENT_BATCH_SIZE,
    async (node): Promise<RawComponent> => {
      const { variant, bindings } = await mapVariant(node, yieldIfDue);
      if (bindings.truncated) truncatedCount++;
      return {
        id: node.id,
        key: node.key ?? node.id,
        name: node.name,
        description: node.description ?? '',
        isComponentSet: false,
        pageName: findPageName(node),
        properties: await mapPropertyDefinitions(node.componentPropertyDefinitions),
        variants: [variant],
        layout: readLayout(node),
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
