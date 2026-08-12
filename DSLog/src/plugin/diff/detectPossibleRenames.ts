import type { Change } from "@shared/types/change";
import type { ComponentSnapshot } from "@shared/types/component";
import type { TokenSnapshot } from "@shared/types/token";
import type { DesignSystemSnapshot } from "@shared/types/project";
import { componentStructuralSignature, tokenStructuralSignature } from "./structuralSignature";

/**
 * Post-pass over already-classified "-added"/"-removed" changes: pairs an
 * added entity with a removed entity when they share a stable key
 * (component key / variable key) or a matching structural signature, and
 * links them via `possibleRenameOf` for the UI to surface as a rename
 * suggestion (spec §13). Never merges the underlying add+remove Changes —
 * both remain in the change list until a human confirms or dismisses.
 */
export function detectPossibleRenames(
  changes: Change[],
  baseline: DesignSystemSnapshot,
  current: DesignSystemSnapshot,
): void {
  detectComponentRenames(changes, baseline.components, current.components);
  detectTokenRenames(changes, baseline.tokens, current.tokens);
}

function detectComponentRenames(changes: Change[], baseline: ComponentSnapshot[], current: ComponentSnapshot[]): void {
  const removedChanges = changes.filter((c) => c.changeType === "component-removed");
  const addedChanges = changes.filter((c) => c.changeType === "component-added");
  if (removedChanges.length === 0 || addedChanges.length === 0) return;

  const baselineById = new Map(baseline.map((c) => [c.identity.id, c]));
  const currentById = new Map(current.map((c) => [c.identity.id, c]));
  const usedAddedIds = new Set<string>();

  for (const removedChange of removedChanges) {
    const removedEntity = baselineById.get(removedChange.entityId);
    if (!removedEntity) continue;

    const keyMatch = removedEntity.identity.key
      ? addedChanges.find((c) => {
          if (usedAddedIds.has(c.id)) return false;
          const entity = currentById.get(c.entityId);
          return entity?.identity.key !== undefined && entity.identity.key === removedEntity.identity.key;
        })
      : undefined;

    const match =
      keyMatch ??
      addedChanges.find((c) => {
        if (usedAddedIds.has(c.id)) return false;
        const entity = currentById.get(c.entityId);
        return entity !== undefined && componentStructuralSignature(entity) === componentStructuralSignature(removedEntity);
      });

    if (match) {
      usedAddedIds.add(match.id);
      match.possibleRenameOf = removedChange.id;
    }
  }
}

function detectTokenRenames(changes: Change[], baseline: TokenSnapshot[], current: TokenSnapshot[]): void {
  const removedChanges = changes.filter((c) => c.changeType === "token-removed");
  const addedChanges = changes.filter((c) => c.changeType === "token-added");
  if (removedChanges.length === 0 || addedChanges.length === 0) return;

  const baselineById = new Map(baseline.map((t) => [t.id, t]));
  const currentById = new Map(current.map((t) => [t.id, t]));
  const usedAddedIds = new Set<string>();

  for (const removedChange of removedChanges) {
    const removedEntity = baselineById.get(removedChange.entityId);
    if (!removedEntity) continue;

    const keyMatch = removedEntity.key
      ? addedChanges.find((c) => {
          if (usedAddedIds.has(c.id)) return false;
          const entity = currentById.get(c.entityId);
          return entity?.key !== undefined && entity.key === removedEntity.key;
        })
      : undefined;

    const match =
      keyMatch ??
      addedChanges.find((c) => {
        if (usedAddedIds.has(c.id)) return false;
        const entity = currentById.get(c.entityId);
        return (
          entity !== undefined &&
          entity.type === removedEntity.type &&
          tokenStructuralSignature(entity) === tokenStructuralSignature(removedEntity)
        );
      });

    if (match) {
      usedAddedIds.add(match.id);
      match.possibleRenameOf = removedChange.id;
    }
  }
}
