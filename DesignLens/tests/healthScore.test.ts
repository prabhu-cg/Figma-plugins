import { describe, expect, it } from "vitest";
import { AUDIT_CATEGORIES, type AuditCategory, type Issue } from "../src/shared/types";
import { CATEGORY_WEIGHTS, computeHealthScore } from "../src/plugin/scoring/healthScore";

function issue(category: AuditCategory, severity: Issue["severity"]): Issue {
  return {
    id: "x",
    ruleId: "r",
    category,
    severity,
    title: "t",
    description: "d",
    whyItMatters: "w",
    recommendation: "r",
    estimatedImpact: "low",
    estimatedEffort: "low",
    status: "open"
  };
}

const denominators = Object.fromEntries(AUDIT_CATEGORIES.map((c) => [c, 10])) as Record<AuditCategory, number>;

describe("computeHealthScore", () => {
  it("weights sum to 1", () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("scores a clean file 100", () => {
    const h = computeHealthScore([], denominators);
    expect(h.overall).toBe(100);
    expect(h.totalCritical + h.totalWarnings + h.totalSuggestions).toBe(0);
  });

  it("penalizes by severity relative to the denominator", () => {
    const h = computeHealthScore([issue("tokens", "critical")], denominators);
    const tokens = h.categories.find((c) => c.category === "tokens")!;
    expect(tokens.score).toBe(99); // penalty = 10 (critical) / denominator 10 = 1 point
    expect(tokens.criticalCount).toBe(1);
    expect(h.categories.find((c) => c.category === "spacing")!.score).toBe(100);
  });

  it("scales the penalty down as the denominator grows", () => {
    const small = computeHealthScore([issue("tokens", "critical")], { ...denominators, tokens: 5 });
    const large = computeHealthScore([issue("tokens", "critical")], { ...denominators, tokens: 50 });
    expect(small.categories.find((c) => c.category === "tokens")!.score).toBeLessThan(
      large.categories.find((c) => c.category === "tokens")!.score
    );
  });

  it("clamps at 0 and counts totals per severity", () => {
    const flood = Array.from({ length: 200 }, () => issue("spacing", "critical"));
    const issues = [...flood, issue("tokens", "warning"), issue("tokens", "suggestion")];
    const h = computeHealthScore(issues, denominators);
    expect(h.categories.find((c) => c.category === "spacing")!.score).toBe(0);
    expect(h.totalCritical).toBe(200);
    expect(h.totalWarnings).toBe(1);
    expect(h.totalSuggestions).toBe(1);
  });

  it("does not let the zero-weight deprecated category move the overall score", () => {
    const issues = Array.from({ length: 50 }, () => issue("deprecated", "critical"));
    expect(computeHealthScore(issues, denominators).overall).toBe(100);
  });
});
