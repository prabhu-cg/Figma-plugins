import type { Issue } from "@shared/types";
import type { AuditRule, RuleContext } from "./types";

class RuleRegistry {
  private rules = new Map<string, AuditRule>();

  register(rule: AuditRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Duplicate audit rule id: ${rule.id}`);
    }
    this.rules.set(rule.id, rule);
  }

  registerAll(rules: AuditRule[]): void {
    for (const rule of rules) this.register(rule);
  }

  getAll(): AuditRule[] {
    return Array.from(this.rules.values());
  }

  async runAll(
    context: RuleContext,
    onProgress?: (ruleTitle: string, index: number, total: number) => void
  ): Promise<Issue[]> {
    const issues: Issue[] = [];
    const all = this.getAll();
    let issueSeq = 0;

    for (let i = 0; i < all.length; i++) {
      if (context.isCancelled()) break;
      const rule = all[i];
      onProgress?.(rule.title, i + 1, all.length);

      let findings;
      try {
        findings = await rule.evaluate(context);
      } catch (err) {
        findings = [
          {
            message: `Rule "${rule.id}" threw an error during evaluation: ${
              err instanceof Error ? err.message : String(err)
            }`,
            severity: "warning" as const
          }
        ];
      }

      for (const finding of findings) {
        issueSeq += 1;
        issues.push({
          id: `${rule.id}-${issueSeq}`,
          ruleId: rule.id,
          category: rule.category,
          severity: finding.severity ?? rule.severity,
          title: rule.title,
          description: finding.message,
          whyItMatters: rule.whyItMatters,
          recommendation: rule.recommendation(finding),
          estimatedImpact: finding.impact ?? "medium",
          estimatedEffort: finding.effort ?? "low",
          reference: rule.reference,
          node: finding.node,
          collection: finding.collection,
          status: "open",
          meta: finding.meta
        });
      }

      // Yield to the event loop between rules so Figma's UI thread stays responsive.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return issues;
  }
}

export const ruleRegistry = new RuleRegistry();
