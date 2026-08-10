import type { DesignSystemSnapshot } from "@shared/types/project";
import type { ChangeSet } from "@shared/types/change";
import { generateId } from "@shared/utils/id";
import { classifyAll } from "@plugin/classifier/classify";
import { diffComponents } from "./diffComponents";
import { diffTokens } from "./diffTokens";

export interface ScanSummaryInput {
  componentsScanned: number;
  componentsSkipped: number;
  tokensScanned: number;
  tokensSkipped: number;
  skippedItems: Array<{ id: string; name: string; reason: string }>;
}

export function diffSnapshots(
  baselineId: string,
  baseline: DesignSystemSnapshot,
  current: DesignSystemSnapshot,
  scanSummary: ScanSummaryInput,
): ChangeSet {
  const rawComponentChanges = diffComponents(baseline.components, current.components);
  const rawTokenChanges = diffTokens(baseline.tokens, current.tokens);

  const changes = classifyAll([...rawComponentChanges, ...rawTokenChanges]);

  return {
    id: generateId("changeset"),
    baselineId,
    createdAt: new Date().toISOString(),
    changes,
    scanSummary,
  };
}
