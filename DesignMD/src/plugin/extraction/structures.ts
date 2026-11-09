/**
 * Reads the structure of components (layer tree, variant diffs, full property details) for
 * components.json. Runs at generate time, only when that output is selected, because it is far
 * more work than the token scan. Each component is isolated: one that fails or runs over budget
 * becomes a warning, never a crash.
 */
import type {
  ComponentPropertyV1,
  ComponentsWarning,
  Layer,
  PreferredValue,
  VariantDiff,
} from '@shared/componentsSchema';
import type { ComponentDoc } from '@shared/types';
import { cleanPropertyName } from '@shared/naming';
import { assignRoles } from '../transform/roles';
import { diffVariant } from '../transform/variantDiffs';
import { createTimeSlicer, isCancelled, processInBatches } from '../utils/async';
import { defaultVariantOf } from './components';
import { readLayerTree, type ReadLayerOptions, type ReadStats } from './layers';

/** A set with more variants than this gets no diffs. */
export const MAX_VARIANTS_FOR_DIFFS = 128;
/** Wall-clock budget for the layers and diffs of one component. */
export const COMPONENT_TIME_BUDGET_MS = 5000;
/**
 * Wall-clock budget for reading every component in one generate. The per-component budget alone
 * would allow (components x 5 s) in the worst case. A real 2,581-component file took 3 min 36 s,
 * so this is a safety net with roughly 3x headroom, not something a normal file reaches.
 */
export const TOTAL_TIME_BUDGET_MS = 10 * 60 * 1000;
/** Budget for the serialized variant diffs of one component. Keeps one huge set from dominating memory. */
export const COMPONENT_MEMORY_BUDGET_BYTES = 4 * 1024 * 1024;
/** Small: a batch runs its components side by side, and Figma's API calls are not parallel anyway. */
const BATCH_SIZE = 4;

export interface StructureOptions extends Pick<ReadLayerOptions, 'includeText' | 'resolveToken'> {
  includeVariantDiffs?: boolean;
  timeBudgetMs?: number;
  /** Wall-clock budget for the whole run. Defaults to TOTAL_TIME_BUDGET_MS. */
  totalBudgetMs?: number;
  /** Approximate cap, in serialized bytes, on the variant diffs of one component. */
  memoryBudgetBytes?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
  /** Absolute time (same clock as `now`) after which no further layers are read. */
  deadline?: number;
  /** Hands control back to Figma now and then. Defaults to a 12 ms time slicer per component. */
  yieldIfDue?: () => Promise<void>;
  /** Receives counters for the run. */
  stats?: ReadStats;
}

export type { ComponentStructure, StructureResult } from '@shared/structureTypes';
export { isStructure } from '@shared/structureTypes';
import type { ComponentStructure, StructureResult } from '@shared/structureTypes';

type Def = {
  type?: string;
  defaultValue?: unknown;
  variantOptions?: string[];
  preferredValues?: Array<{ type?: string; key?: string }>;
};

async function nodeById(id: string): Promise<{ id: string; name: string } | undefined> {
  try {
    const n = (await figma.getNodeByIdAsync(id)) as
      (BaseNode & { parent: (BaseNode & { name: string }) | null }) | null;
    if (!n) return undefined;
    const name = n.parent?.type === 'COMPONENT_SET' ? n.parent.name : n.name;
    return { id: n.id, name };
  } catch {
    return undefined;
  }
}

async function readProperties(
  defs: Record<string, Def> | undefined,
): Promise<ComponentPropertyV1[]> {
  if (!defs) return [];
  const out: ComponentPropertyV1[] = [];
  for (const [key, def] of Object.entries(defs)) {
    const type = def.type as ComponentPropertyV1['type'];
    const prop: ComponentPropertyV1 = {
      key,
      name: cleanPropertyName(key),
      type,
      defaultValue: String(def.defaultValue ?? ''),
    };
    if (type === 'INSTANCE_SWAP' && typeof def.defaultValue === 'string') {
      const resolved = await nodeById(def.defaultValue);
      if (resolved) prop.defaultResolved = resolved;
    }
    if (def.variantOptions) prop.variantOptions = [...def.variantOptions];
    const preferred: PreferredValue[] = (def.preferredValues ?? []).flatMap((p) =>
      (p.type === 'COMPONENT' || p.type === 'COMPONENT_SET') && typeof p.key === 'string'
        ? [{ type: p.type, key: p.key }]
        : [],
    );
    if (preferred.length > 0) prop.preferredValues = preferred;
    out.push(prop);
  }
  return out;
}

/** Reads one component or component set. Throws on failure; callers isolate. */
export async function extractComponentStructure(
  node: ComponentNode | ComponentSetNode,
  options: StructureOptions = {},
): Promise<ComponentStructure> {
  const now = options.now ?? Date.now;
  const started = now();
  const budget = options.timeBudgetMs ?? COMPONENT_TIME_BUDGET_MS;
  const memoryBudget = options.memoryBudgetBytes ?? COMPONENT_MEMORY_BUDGET_BYTES;
  let diffBytes = 0;
  // Stops layer reading when the run is cancelled, the whole-run deadline passes, or this component
  // has used up its own budget. Checked per layer, so one huge tree cannot overrun either.
  const shouldStop = () =>
    isCancelled() ||
    (options.deadline !== undefined && now() > options.deadline) ||
    now() - started > budget;
  const readOptions = {
    includeText: options.includeText,
    resolveToken: options.resolveToken,
    shouldStop,
    stats: options.stats,
    yieldIfDue: options.yieldIfDue ?? createTimeSlicer(),
  };
  const warnings: ComponentsWarning[] = [];

  const members =
    node.type === 'COMPONENT_SET'
      ? node.children.filter((c): c is ComponentNode => c.type === 'COMPONENT')
      : [node];
  if (members.length === 0) throw new Error('The component set has no variants.');
  const defaultNode = node.type === 'COMPONENT_SET' ? defaultVariantOf(node, members) : node;

  // Variants are named "State=Hover"; paths in diffs start at the component's own name instead.
  const named = (tree: Layer): Layer => ({ ...tree, name: node.name });
  const base = await readLayerTree(defaultNode, readOptions);
  base.tree = named(base.tree);
  warnings.push(...base.warnings);
  let truncated = base.truncated;
  const variables = new Set(base.usedVariableIds);
  const styles = new Set(base.usedStyleIds);

  const diffs: VariantDiff[] = [];
  const duplicateGroups = new Map<string, ComponentsWarning>();
  const others = members.filter((m) => m.id !== defaultNode.id);
  const wantDiffs = options.includeVariantDiffs !== false && others.length > 0;
  if (wantDiffs && members.length > MAX_VARIANTS_FOR_DIFFS) {
    warnings.push({
      code: 'VARIANT_DIFFS_SKIPPED',
      message: `"${node.name}" has ${members.length} variants (more than ${MAX_VARIANTS_FOR_DIFFS}), so variant diffs were skipped.`,
      componentId: node.id,
    });
  } else if (wantDiffs) {
    for (const variant of others) {
      if (isCancelled()) {
        truncated = true;
        warnings.push({
          code: 'SCAN_CANCELLED',
          message: `Generation was cancelled while reading "${node.name}", so its variant diffs stop after ${diffs.length} of ${others.length} variants.`,
          componentId: node.id,
        });
        break;
      }
      if (options.deadline !== undefined && now() > options.deadline) {
        truncated = true;
        warnings.push({
          code: 'TIME_BUDGET_EXCEEDED',
          message: `The overall time limit was reached while reading "${node.name}", so its variant diffs stop after ${diffs.length} of ${others.length} variants.`,
          componentId: node.id,
        });
        break;
      }
      if (now() - started > budget) {
        truncated = true;
        warnings.push({
          code: 'TREE_TRUNCATED',
          message: `"${node.name}" took longer than ${budget} ms, so variant diffs stop after ${diffs.length} of ${others.length} variants.`,
          componentId: node.id,
        });
        break;
      }
      const read = await readLayerTree(variant, readOptions);
      if (read.truncated) truncated = true;
      read.usedVariableIds.forEach((id) => variables.add(id));
      read.usedStyleIds.forEach((id) => styles.add(id));
      const { diff, warnings: diffWarnings } = diffVariant(base.tree, named(read.tree), {
        variantId: variant.id,
        variantProperties: { ...(variant.variantProperties ?? {}) },
        componentId: node.id,
      });
      diff.added = diff.added.map((a) => ({ ...a, layer: assignRoles(a.layer, false) }));
      diffBytes += JSON.stringify(diff).length;
      if (diffBytes > memoryBudget) {
        truncated = true;
        warnings.push({
          code: 'TREE_TRUNCATED',
          message: `"${node.name}" has more variant differences than the size budget (${Math.round(memoryBudget / 1024)} KB), so diffs stop after ${diffs.length} of ${others.length} variants.`,
          componentId: node.id,
        });
        break;
      }
      diffs.push(diff);
      // Duplicate names are common and repeat for every variant, so they are counted per
      // component (one warning below) instead of one warning per group of layers.
      for (const w of diffWarnings) {
        if (w.code === 'DUPLICATE_SIBLING_NAME' && w.layerId) duplicateGroups.set(w.layerId, w);
        else warnings.push(w);
      }
      for (const w of read.warnings) {
        if (w.code === 'UNRESOLVED_REFERENCE') {
          if (!warnings.some((x) => x.message === w.message)) warnings.push(w);
        }
      }
    }
  }

  if (duplicateGroups.size > 0) {
    const first = [...duplicateGroups.values()][0];
    warnings.push({
      code: 'DUPLICATE_SIBLING_NAME',
      message: `${duplicateGroups.size} group${duplicateGroups.size === 1 ? '' : 's'} of sibling layers in "${node.name}" share a name, so variant differences tell them apart by index (for example: ${first.message}).`,
      componentId: node.id,
      layerId: first.layerId,
    });
  }

  let properties: ComponentPropertyV1[] = [];
  try {
    properties = await readProperties(
      node.componentPropertyDefinitions as unknown as Record<string, Def> | undefined,
    );
  } catch (err) {
    // The layers are still useful without the property list.
    warnings.push({
      code: 'PROPERTIES_UNREADABLE',
      message: `The component properties of "${node.name}" could not be read: ${err instanceof Error ? err.message : String(err)}.`,
      componentId: node.id,
    });
  }

  return {
    properties,
    defaultVariantId: defaultNode.id,
    tree: assignRoles(base.tree),
    variantDiffs: diffs,
    treeTruncated: truncated,
    usedVariableIds: Array.from(variables),
    usedStyleIds: Array.from(styles),
    warnings: warnings.map((w) => (w.componentId ? w : { ...w, componentId: node.id })),
  };
}

/**
 * Reads the structure of each component by id. A component that cannot be found or that throws is
 * reported as `{ error }` and the rest continue.
 */
export async function extractStructures(
  components: readonly ComponentDoc[],
  options: StructureOptions = {},
  onProgress?: (done: number, total: number) => void,
  /**
   * Called after each batch with the results finished since the last call. With this, results do
   * not need to be kept: pass `retain: false` and the returned map stays empty.
   */
  onResults?: (items: Array<[string, StructureResult]>) => void,
  retain = true,
): Promise<Map<string, StructureResult>> {
  const now = options.now ?? Date.now;
  const deadline = options.deadline ?? now() + (options.totalBudgetMs ?? TOTAL_TIME_BUDGET_MS);
  // One slicer for the whole run, so the time between yields is counted across components.
  const yieldIfDue = options.yieldIfDue ?? createTimeSlicer();
  const kept = new Map<string, StructureResult>();
  let pending: Array<[string, StructureResult]> = [];

  const record = (id: string, result: StructureResult) => {
    if (retain) kept.set(id, result);
    pending.push([id, result]);
  };
  const flush = () => {
    if (pending.length > 0 && onResults) onResults(pending);
    pending = [];
  };

  await processInBatches(
    [...components],
    BATCH_SIZE,
    async (doc) => {
      if (now() > deadline) {
        record(doc.id, { error: 'The overall time limit was reached.', timedOut: true });
        return;
      }
      try {
        const node = await figma.getNodeByIdAsync(doc.id);
        if (!node || (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')) {
          record(doc.id, { error: 'The component could not be found in the file.' });
          return;
        }
        record(doc.id, await extractComponentStructure(node, { ...options, deadline, yieldIfDue }));
      } catch (err) {
        record(doc.id, { error: err instanceof Error ? err.message : String(err) });
      }
    },
    (done, total) => {
      flush();
      onProgress?.(done, total);
    },
  );
  flush();

  // A cancelled run stops before some batches; those components are marked, not dropped.
  for (const doc of components) {
    if (!kept.has(doc.id) && retain) {
      kept.set(doc.id, { error: 'Generation was cancelled.', cancelled: true });
    }
  }
  return kept;
}
