import { describe, expect, it } from "vitest";
import { ruleRegistry } from "../src/plugin/rules/registry";
import type { AuditRule, RuleContext } from "../src/plugin/rules/types";

const ctx = { isCancelled: () => false } as unknown as RuleContext;

function rule(id: string, evaluate: AuditRule["evaluate"]): AuditRule {
  return {
    id,
    category: "tokens",
    title: id,
    description: "",
    whyItMatters: "",
    severity: "suggestion",
    evaluate,
    recommendation: () => "fix it"
  };
}

describe("ruleRegistry", () => {
  it("rejects duplicate rule ids", () => {
    ruleRegistry.register(rule("t-dup", () => []));
    expect(() => ruleRegistry.register(rule("t-dup", () => []))).toThrow(/Duplicate/);
  });

  it("turns a throwing rule into a warning issue instead of failing the scan", async () => {
    ruleRegistry.register(
      rule("t-throws", () => {
        throw new Error("boom");
      })
    );
    const issues = (await ruleRegistry.runAll(ctx)).filter((i) => i.ruleId === "t-throws");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].description).toContain("boom");
  });

  it("defaults the discriminator to the message for node-less findings only", async () => {
    ruleRegistry.register(
      rule("t-disc", () => [
        { message: "file-level A" },
        { message: "with node", node: { id: "1", name: "n", type: "FRAME", pageId: "", pageName: "" } },
        { message: "explicit", key: "k" }
      ])
    );
    const issues = (await ruleRegistry.runAll(ctx)).filter((i) => i.ruleId === "t-disc");
    expect(issues.map((i) => i.discriminator)).toEqual(["file-level A", undefined, "k"]);
  });

  it("applies rule defaults for severity, impact and effort", async () => {
    ruleRegistry.register(rule("t-defaults", () => [{ message: "m" }]));
    const [issue] = (await ruleRegistry.runAll(ctx)).filter((i) => i.ruleId === "t-defaults");
    expect(issue).toMatchObject({ severity: "suggestion", estimatedImpact: "medium", estimatedEffort: "low", status: "open" });
  });
});
