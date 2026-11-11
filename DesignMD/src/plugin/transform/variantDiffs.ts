/**
 * Variant diffs for components.json. Variants of a set share a layer structure, but Figma node ids
 * differ per variant, so layers are matched by name path from the root ("Button/Label"). Siblings
 * that share a name get an index ("Icon[1]") and a DUPLICATE_SIBLING_NAME warning.
 *
 * Pure: takes two Layer trees, returns the differences of the second from the first.
 */
import type {
  AddedLayer,
  ComponentsWarning,
  Layer,
  LayerChanges,
  LayerDiff,
  ReorderedChildren,
  VariantDiff,
} from '@shared/componentsSchema';

/** Attributes compared between variants. Identity fields, roles and children are not attributes. */
const ATTRIBUTES = [
  'visible',
  'size',
  'box',
  'effectiveOpacity',
  'position',
  'rotation',
  'constraints',
  'placement',
  'sizeLimits',
  'clipsContent',
  'isMask',
  'blendMode',
  'cornerSmoothing',
  'layoutGrids',
  'bindings',
  'layout',
  'radius',
  'opacity',
  'fills',
  'strokes',
  'effects',
  'text',
  'vector',
  'instanceOf',
  'propertyRefs',
] as const satisfies ReadonlyArray<keyof LayerChanges>;

interface Indexed {
  layer: Layer;
  parentPath: string | undefined;
  /** Position among the parent's children in this tree. 0 for the root. */
  index: number;
}

/** Name paths for every layer in a tree, in document order. Reports duplicated sibling names. */
function indexTree(
  root: Layer,
  warnings: ComponentsWarning[],
  componentId: string | undefined,
): Map<string, Indexed> {
  const out = new Map<string, Indexed>();
  const visit = (layer: Layer, path: string, parentPath: string | undefined, index: number) => {
    out.set(path, { layer, parentPath, index });
    const counts = new Map<string, number>();
    for (const child of layer.children) counts.set(child.name, (counts.get(child.name) ?? 0) + 1);
    const seen = new Map<string, number>();
    for (const [childIndex, child] of layer.children.entries()) {
      const total = counts.get(child.name)!;
      const n = seen.get(child.name) ?? 0;
      seen.set(child.name, n + 1);
      const segment = total > 1 ? `${child.name}[${n}]` : child.name;
      if (total > 1 && n === 0) {
        warnings.push({
          code: 'DUPLICATE_SIBLING_NAME',
          message: `Layers inside "${path}" share the name "${child.name}", so they are told apart by index.`,
          ...(componentId ? { componentId } : {}),
          layerId: child.id,
        });
      }
      visit(child, `${path}/${segment}`, path, childIndex);
    }
  };
  visit(root, root.name, undefined, 0);
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function changesBetween(base: Layer, other: Layer): LayerChanges {
  const changes: Record<string, unknown> = {};
  for (const key of ATTRIBUTES) {
    const before = base[key];
    const after = other[key];
    if (after === undefined) {
      // A missing radius means square corners, so losing it is a change. For the other attributes
      // a missing value means "not applicable" in this variant, which v1 cannot express as a change.
      if (key === 'radius' && before !== undefined) changes.radius = 0;
      continue;
    }
    if (!same(before, after)) changes[key] = after;
  }
  return changes as LayerChanges;
}

export interface DiffResult {
  diff: VariantDiff;
  warnings: ComponentsWarning[];
}

/**
 * How `variant` differs from `base`. A layer whose type changed counts as removed plus added.
 * Only the top-most added or removed layers are listed; their children come along inside them.
 */
export function diffVariant(
  base: Layer,
  variant: Layer,
  info: { variantId: string; variantProperties: Record<string, string>; componentId?: string },
): DiffResult {
  const warnings: ComponentsWarning[] = [];
  const baseIndex = indexTree(base, [], undefined);
  const variantIndex = indexTree(variant, warnings, info.componentId);

  const layers: LayerDiff[] = [];
  const added: AddedLayer[] = [];
  const removed: string[] = [];
  const reordered: ReorderedChildren[] = [];

  const isMatch = (path: string) => {
    const a = baseIndex.get(path);
    const b = variantIndex.get(path);
    return !!a && !!b && a.layer.type === b.layer.type;
  };

  for (const [path, entry] of variantIndex) {
    if (isMatch(path)) {
      const changes = changesBetween(baseIndex.get(path)!.layer, entry.layer);
      if (Object.keys(changes).length > 0) {
        layers.push({ path, layerId: baseIndex.get(path)!.layer.id, changes });
      }
    } else if (entry.parentPath === undefined || isMatch(entry.parentPath)) {
      added.push({
        parentPath: entry.parentPath ?? '',
        index: entry.index,
        layer: entry.layer,
      });
    }
  }
  for (const [path, entry] of baseIndex) {
    if (!isMatch(path) && (entry.parentPath === undefined || isMatch(entry.parentPath))) {
      removed.push(path);
    }
  }

  // Parents that exist in both: do they draw the same children in a different order, and are any
  // same-named siblings different in number (so that a match by name path is a guess)?
  for (const [path, entry] of variantIndex) {
    if (!isMatch(path)) continue;
    const baseKids = baseIndex.get(path)!.layer.children;
    const variantKids = entry.layer.children;
    if (baseKids.length === 0 && variantKids.length === 0) continue;

    const pathsOf = (parent: string, kids: Layer[]) => {
      const counts = new Map<string, number>();
      for (const k of kids) counts.set(k.name, (counts.get(k.name) ?? 0) + 1);
      const seen = new Map<string, number>();
      return kids.map((k) => {
        const n = seen.get(k.name) ?? 0;
        seen.set(k.name, n + 1);
        return `${parent}/${counts.get(k.name)! > 1 ? `${k.name}[${n}]` : k.name}`;
      });
    };
    const basePaths = pathsOf(path, baseKids);
    const variantPaths = pathsOf(path, variantKids);
    const inVariant = new Set(variantPaths);
    const inBase = new Set(basePaths);
    const commonBase = basePaths.filter((p) => inVariant.has(p));
    const commonVariant = variantPaths.filter((p) => inBase.has(p));
    if (commonBase.some((p, i) => p !== commonVariant[i])) {
      reordered.push({ parentPath: path, order: variantPaths });
    }

    const count = (kids: Layer[]) => {
      const m = new Map<string, number>();
      for (const k of kids) m.set(k.name, (m.get(k.name) ?? 0) + 1);
      return m;
    };
    const a = count(baseKids);
    const b = count(variantKids);
    const unsure = [...new Set([...a.keys(), ...b.keys()])].filter(
      (name) =>
        (a.get(name) ?? 0) !== (b.get(name) ?? 0) &&
        Math.max(a.get(name) ?? 0, b.get(name) ?? 0) > 1,
    );
    if (unsure.length > 0) {
      warnings.push({
        code: 'AMBIGUOUS_SIBLINGS',
        message: `Inside "${path}" the default variant and this variant have a different number of layers named ${unsure.map((n) => `"${n}"`).join(', ')}, so matching them by position is a guess. Use layerId.`,
        ...(info.componentId ? { componentId: info.componentId } : {}),
        variantId: info.variantId,
        layerId: baseIndex.get(path)!.layer.id,
      });
    }
  }

  return {
    diff: {
      variantId: info.variantId,
      variantProperties: info.variantProperties,
      layers,
      added,
      removed,
      reordered,
    },
    warnings,
  };
}
