import { ruleRegistry } from "./registry";
import { contrastRules } from "./contrast";
import { typographyRules } from "./typography";
import { spacingRules } from "./spacing";
import { tokenRules } from "./tokens";
import { componentRules } from "./components";
import { stateRules } from "./states";
import { accessibilityRules } from "./accessibility";
import { documentationRules } from "./documentation";
import { governanceRules } from "./governance";
import { deprecatedRules } from "./deprecated";
import { visualRules } from "./visual";

export function registerAllRules(): void {
  ruleRegistry.registerAll([
    ...contrastRules,
    ...typographyRules,
    ...spacingRules,
    ...tokenRules,
    ...componentRules,
    ...stateRules,
    ...accessibilityRules,
    ...documentationRules,
    ...governanceRules,
    ...deprecatedRules,
    ...visualRules
  ]);
}

export { ruleRegistry } from "./registry";
export type { AuditRule, RuleContext, RuleFinding, ComponentRecord } from "./types";
