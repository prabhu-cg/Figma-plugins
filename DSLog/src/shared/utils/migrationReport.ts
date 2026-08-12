import type { Change } from "@shared/types/change";
import type { TrackedEntity } from "@shared/types/entity";

export interface MigrationItem {
  entityId: string;
  entityName: string;
  note: string;
  source: "breaking-change" | "deprecation";
}

/**
 * Compiles migration actions (spec §6) from two already-tracked sources —
 * changes with a migration note, and deprecated entities with a
 * replacement/migration note — deduped by entity so a component that's
 * both a breaking change *and* deprecated only shows up once.
 */
export function buildMigrationReport(changes: Change[], trackedEntities: TrackedEntity[]): MigrationItem[] {
  const items: MigrationItem[] = [];
  const seenEntityIds = new Set<string>();

  for (const change of changes) {
    const note = change.migrationNote?.trim();
    if (!note) continue;
    items.push({ entityId: change.entityId, entityName: change.entityName, note, source: "breaking-change" });
    seenEntityIds.add(change.entityId);
  }

  for (const entity of trackedEntities) {
    if (!entity.deprecated || seenEntityIds.has(entity.id)) continue;
    const replacement = entity.replacement?.trim();
    const migrationNote = entity.migrationNote?.trim();
    if (!replacement && !migrationNote) continue;
    const note = replacement ? `Replace with ${replacement}${migrationNote ? ` — ${migrationNote}` : ""}` : (migrationNote as string);
    items.push({ entityId: entity.id, entityName: entity.displayName, note, source: "deprecation" });
  }

  return items;
}
