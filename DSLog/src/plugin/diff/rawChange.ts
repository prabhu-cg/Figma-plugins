import type { ChangeEntityType } from "@shared/types/change";

/** Pre-classification diff output. The classifier turns this into a full Change. */
export interface RawChange {
  entityType: ChangeEntityType;
  entityId: string;
  entityName: string;
  changeType: string;
  field?: string;
  before?: unknown;
  after?: unknown;
  modeDetails?: Array<{ modeName: string; before?: unknown; after?: unknown; changed: boolean }>;
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
