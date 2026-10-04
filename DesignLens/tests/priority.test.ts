import { describe, expect, it } from "vitest";
import { AUDIT_CATEGORIES, type AuditCategory, type ScanResult } from "../src/shared/types";
import { CATEGORY_WEIGHTS } from "../src/shared/scoring";
import { priorityCategories } from "../src/ui/lib/metrics";

function result(over: Partial<Record<AuditCategory, { score: number; critical?: number; warnings?: number }>>): ScanResult {
  const categories = AUDIT_CATEGORIES.map((category) => ({
    category,
    score: over[category]?.score ?? 100,
    weight: CATEGORY_WEIGHTS[category],
    criticalCount: over[category]?.critical ?? 0,
    warningCount: over[category]?.warnings ?? 0,
    suggestionCount: 0,
    passCount: 0
  }));
  return { health: { overall: 0, categories } } as unknown as ScanResult;
}

describe("priorityCategories", () => {
  it("ranks by overall-score leverage (weight x points lost), not raw score", () => {
    // visual: very low score but weight 0.02 -> 1.6 pts. tokens: moderate score, weight 0.15 -> 6 pts.
    const out = priorityCategories(result({ visual: { score: 20, warnings: 3 }, tokens: { score: 60, warnings: 5 } }));
    expect(out.map((c) => c.category)).toEqual(["tokens", "visual"]);
  });

  it("never suggests zero-weight, issue-free, or perfect categories", () => {
    const out = priorityCategories(
      result({ deprecated: { score: 10, critical: 5 }, spacing: { score: 90 }, typography: { score: 100, warnings: 1 } })
    );
    expect(out).toEqual([]);
  });

  it("only counts critical/warning issues as a reason to review, and respects the limit", () => {
    const many = result({
      tokens: { score: 50, warnings: 1 },
      accessibility: { score: 50, critical: 1 },
      contrast: { score: 50, critical: 1 },
      components: { score: 50, warnings: 1 }
    });
    expect(priorityCategories(many, 2)).toHaveLength(2);
  });
});
