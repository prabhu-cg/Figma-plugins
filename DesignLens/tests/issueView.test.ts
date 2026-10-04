import { describe, expect, it } from "vitest";
import type { Issue } from "../src/shared/types";
import { countFacets, DEFAULT_FILTERS, filterIssues, issueLabel, sortIssues, stepSelection } from "../src/ui/lib/issueView";

let n = 0;
function issue(over: Partial<Issue> = {}): Issue {
  n += 1;
  return {
    id: `i${n}`,
    ruleId: "r",
    category: "tokens",
    severity: "warning",
    title: `Title ${n}`,
    description: "desc",
    whyItMatters: "",
    recommendation: "",
    estimatedImpact: "medium",
    estimatedEffort: "low",
    status: "open",
    ...over
  };
}

describe("sortIssues", () => {
  const critLow = issue({ severity: "critical", estimatedImpact: "low" });
  const critHigh = issue({ severity: "critical", estimatedImpact: "high" });
  const warnHigh = issue({ severity: "warning", estimatedImpact: "high" });
  const sugg = issue({ severity: "suggestion", estimatedImpact: "high" });

  it("orders by severity, then impact", () => {
    expect(sortIssues([sugg, critLow, warnHigh, critHigh], "severity")).toEqual([critHigh, critLow, warnHigh, sugg]);
  });

  it("orders by impact first, breaking ties by severity", () => {
    expect(sortIssues([critLow, sugg, critHigh, warnHigh], "impact")).toEqual([critHigh, warnHigh, sugg, critLow]);
  });

  it("sorts by component name with component-less issues last", () => {
    const node = (name: string) => ({ id: name, name, type: "FRAME", pageId: "", pageName: "", componentName: name });
    const b = issue({ node: node("Banner") });
    const a = issue({ node: node("Alert") });
    const none = issue();
    expect(sortIssues([none, b, a], "component")).toEqual([a, b, none]);
  });

  it("does not mutate its input", () => {
    const input = [warnHigh, critHigh];
    sortIssues(input, "severity");
    expect(input).toEqual([warnHigh, critHigh]);
  });
});

describe("filterIssues", () => {
  const a = issue({ severity: "critical", status: "resolved", title: "Contrast fail" });
  const b = issue({ severity: "warning", title: "Hardcoded fill", description: "in Button" });

  it("returns everything with default filters", () => {
    expect(filterIssues([a, b], DEFAULT_FILTERS)).toHaveLength(2);
  });

  it("combines severity, status and text search", () => {
    expect(filterIssues([a, b], { ...DEFAULT_FILTERS, severity: "critical" })).toEqual([a]);
    expect(filterIssues([a, b], { ...DEFAULT_FILTERS, status: "open" })).toEqual([b]);
    expect(filterIssues([a, b], { ...DEFAULT_FILTERS, search: "button" })).toEqual([b]);
  });
});

describe("countFacets", () => {
  it("counts each facet ignoring its own filter but honoring the others", () => {
    const issues = [
      issue({ severity: "critical", status: "open" }),
      issue({ severity: "critical", status: "resolved" }),
      issue({ severity: "warning", status: "open" })
    ];
    const facets = countFacets(issues, { ...DEFAULT_FILTERS, severity: "critical" });
    expect(facets.severity).toEqual({ critical: 2, warning: 1, suggestion: 0 }); // severity filter ignored
    expect(facets.status).toEqual({ open: 1, resolved: 1, ignored: 0 }); // status counts respect severity=critical
  });
});

describe("stepSelection", () => {
  const ids = ["a", "b", "c"];
  it("moves and clamps at the ends", () => {
    expect(stepSelection(ids, "a", 1)).toBe("b");
    expect(stepSelection(ids, "c", 1)).toBe("c");
    expect(stepSelection(ids, "a", -1)).toBe("a");
  });
  it("starts at the near edge when nothing (or a vanished id) is selected", () => {
    expect(stepSelection(ids, null, 1)).toBe("a");
    expect(stepSelection(ids, null, -1)).toBe("c");
    expect(stepSelection(ids, "gone", 1)).toBe("a");
  });
  it("returns null for an empty list", () => {
    expect(stepSelection([], "a", 1)).toBeNull();
  });
});

describe("issueLabel", () => {
  it("tells identical titles apart by where they occur", () => {
    const node = (name: string) => ({ id: name, name, type: "FRAME", pageId: "", pageName: "", componentName: name });
    const a = issue({ title: "Hardcoded fill", node: node("Button") });
    const b = issue({ title: "Hardcoded fill", node: node("Card") });
    expect(issueLabel(a)).toBe("Hardcoded fill in Button");
    expect(issueLabel(a)).not.toBe(issueLabel(b));
  });

  it("falls back to the module for file-level issues", () => {
    expect(issueLabel(issue({ title: "Unused variable", category: "tokens" }))).toMatch(/^Unused variable in /);
  });
});
