import type { NodeStructureSnapshot } from "@shared/types/component";
import type { RawChange } from "./rawChange";
import { valuesEqual } from "./rawChange";

const MAX_DEPTH = 12;

function matchChildren(
  before: NodeStructureSnapshot[],
  after: NodeStructureSnapshot[],
): Array<{ before?: NodeStructureSnapshot; after?: NodeStructureSnapshot }> {
  const afterByName = new Map<string, NodeStructureSnapshot[]>();
  for (const node of after) {
    const list = afterByName.get(node.name) ?? [];
    list.push(node);
    afterByName.set(node.name, list);
  }

  const pairs: Array<{ before?: NodeStructureSnapshot; after?: NodeStructureSnapshot }> = [];
  const usedAfter = new Set<NodeStructureSnapshot>();

  for (const b of before) {
    const candidates = afterByName.get(b.name);
    const match = candidates?.find((a) => !usedAfter.has(a));
    if (match) {
      usedAfter.add(match);
      pairs.push({ before: b, after: match });
    } else {
      pairs.push({ before: b, after: undefined });
    }
  }

  for (const a of after) {
    if (!usedAfter.has(a)) {
      pairs.push({ before: undefined, after: a });
    }
  }

  return pairs;
}

function pushVisualChanges(
  entityId: string,
  entityName: string,
  path: string,
  before: NodeStructureSnapshot,
  after: NodeStructureSnapshot,
  changes: RawChange[],
): void {
  if (before.type !== after.type) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "structure-child-type-changed",
      field: path,
      before: before.type,
      after: after.type,
    });
  }
  if (before.visible !== after.visible) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "visibility-changed",
      field: path,
      before: before.visible,
      after: after.visible,
    });
  }
  if (before.width !== after.width || before.height !== after.height) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "dimensions-changed",
      field: path,
      before: { width: before.width, height: before.height },
      after: { width: after.width, height: after.height },
    });
  }
  if (before.cornerRadius !== after.cornerRadius) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "corner-radius-changed",
      field: path,
      before: before.cornerRadius,
      after: after.cornerRadius,
    });
  }
  if (!valuesEqual(before.fills, after.fills)) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "fills-changed",
      field: path,
      before: before.fills,
      after: after.fills,
    });
  }
  if (!valuesEqual(before.strokes, after.strokes)) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "strokes-changed",
      field: path,
      before: before.strokes,
      after: after.strokes,
    });
  }
  if (!valuesEqual(before.effects, after.effects)) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "effects-changed",
      field: path,
      before: before.effects,
      after: after.effects,
    });
  }
  if (!valuesEqual(before.typography, after.typography)) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "typography-changed",
      field: path,
      before: before.typography,
      after: after.typography,
    });
  }
  if (!valuesEqual(before.tokenBindings, after.tokenBindings)) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "token-binding-changed",
      field: path,
      before: before.tokenBindings,
      after: after.tokenBindings,
    });
  }
  if (!valuesEqual(before.styleBindings, after.styleBindings)) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "style-binding-changed",
      field: path,
      before: before.styleBindings,
      after: after.styleBindings,
    });
  }

  const beforeLayout = before.layout;
  const afterLayout = after.layout;
  if (beforeLayout?.mode !== afterLayout?.mode) {
    changes.push({
      entityType: "component",
      entityId,
      entityName,
      changeType: "layout-mode-changed",
      field: path,
      before: beforeLayout?.mode,
      after: afterLayout?.mode,
    });
  } else if (beforeLayout && afterLayout) {
    if (
      beforeLayout.paddingTop !== afterLayout.paddingTop ||
      beforeLayout.paddingRight !== afterLayout.paddingRight ||
      beforeLayout.paddingBottom !== afterLayout.paddingBottom ||
      beforeLayout.paddingLeft !== afterLayout.paddingLeft
    ) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "padding-changed",
        field: `${path}.padding`,
        before: {
          top: beforeLayout.paddingTop,
          right: beforeLayout.paddingRight,
          bottom: beforeLayout.paddingBottom,
          left: beforeLayout.paddingLeft,
        },
        after: {
          top: afterLayout.paddingTop,
          right: afterLayout.paddingRight,
          bottom: afterLayout.paddingBottom,
          left: afterLayout.paddingLeft,
        },
      });
    }
    if (beforeLayout.itemSpacing !== afterLayout.itemSpacing) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "gap-changed",
        field: `${path}.gap`,
        before: beforeLayout.itemSpacing,
        after: afterLayout.itemSpacing,
      });
    }
    if (
      beforeLayout.primaryAxisAlign !== afterLayout.primaryAxisAlign ||
      beforeLayout.counterAxisAlign !== afterLayout.counterAxisAlign
    ) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "alignment-changed",
        field: `${path}.alignment`,
        before: { primary: beforeLayout.primaryAxisAlign, counter: beforeLayout.counterAxisAlign },
        after: { primary: afterLayout.primaryAxisAlign, counter: afterLayout.counterAxisAlign },
      });
    }
  }
}

export function diffStructure(
  entityId: string,
  entityName: string,
  before: NodeStructureSnapshot,
  after: NodeStructureSnapshot,
): RawChange[] {
  const changes: RawChange[] = [];

  function walk(b: NodeStructureSnapshot, a: NodeStructureSnapshot, path: string, depth: number): void {
    pushVisualChanges(entityId, entityName, path, b, a, changes);

    if (depth >= MAX_DEPTH) return;

    const pairs = matchChildren(b.children, a.children);
    for (const pair of pairs) {
      if (pair.before && !pair.after) {
        changes.push({
          entityType: "component",
          entityId,
          entityName,
          changeType: "structure-child-removed",
          field: `${path}/${pair.before.name}`,
          before: pair.before.name,
        });
      } else if (!pair.before && pair.after) {
        changes.push({
          entityType: "component",
          entityId,
          entityName,
          changeType: "structure-child-added",
          field: `${path}/${pair.after.name}`,
          after: pair.after.name,
        });
      } else if (pair.before && pair.after) {
        walk(pair.before, pair.after, `${path}/${pair.after.name}`, depth + 1);
      }
    }
  }

  walk(before, after, "root", 0);
  return changes;
}
