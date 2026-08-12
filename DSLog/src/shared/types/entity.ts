export type EntityKind = "component" | "componentSet" | "token" | "variant" | "property";

export type ReviewState = "unreviewed" | "reviewed" | "accepted" | "rejected";

export interface RenameHistoryEntry {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  confirmedAt: string;
}

/**
 * Persistent record for a logical design-system entity, independent of any
 * single snapshot. Carries the parts of V2 that are manual/user-driven
 * (deprecation) or need to survive an id change (rename history) — data
 * that doesn't belong on an auto-scanned ComponentSnapshot/TokenSnapshot.
 */
export interface TrackedEntity {
  id: string;
  kind: EntityKind;
  displayName: string;
  /** variant/property -> owning component id; component -> componentSet id. */
  parentId?: string;
  deprecated: boolean;
  deprecatedAt?: string;
  replacement?: string;
  migrationNote?: string;
  renameHistory: RenameHistoryEntry[];
}

export function makeVariantEntityId(componentId: string, variantName: string): string {
  return `${componentId}::variant::${variantName}`;
}

export function makePropertyEntityId(componentId: string, propertyName: string): string {
  return `${componentId}::prop::${propertyName}`;
}
