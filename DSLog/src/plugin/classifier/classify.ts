import type { RawChange } from "@plugin/diff/rawChange";
import type { Change } from "@shared/types/change";
import { generateId } from "@shared/utils/id";
import { CLASSIFICATION_RULES, DEFAULT_RULE } from "./rules";
import { summarize } from "./summarize";

export function classify(raw: RawChange): Change {
  const rule = CLASSIFICATION_RULES[raw.changeType] ?? DEFAULT_RULE;

  return {
    id: generateId("change"),
    entityType: raw.entityType,
    entityId: raw.entityId,
    entityName: raw.entityName,
    category: rule.category,
    severity: rule.severity,
    changeType: raw.changeType,
    summary: summarize(raw),
    field: raw.field,
    before: raw.before,
    after: raw.after,
    breaking: rule.breaking,
    potentialBreaking: rule.potentialBreaking,
    modeDetails: raw.modeDetails,
    reviewed: false,
    createdAt: new Date().toISOString(),
  };
}

export function classifyAll(raws: RawChange[]): Change[] {
  return raws.map(classify);
}
