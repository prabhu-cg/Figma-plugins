import type { Issue, ScanResult, Severity } from "@shared/types";
import { CATEGORY_LABELS } from "@shared/types";

const SEVERITY_ORDER: Severity[] = ["critical", "warning", "suggestion"];

export function buildMarkdownReport(result: ScanResult): string {
  const { health, stats, tokenStats } = result;
  const lines: string[] = [];

  lines.push("# DesignLens Audit Report", "");
  lines.push(`**File:** ${result.fileName}  `);
  lines.push(`**Scanned:** ${new Date(result.scannedAt).toLocaleString()}  `);
  lines.push(`**Scan duration:** ${(stats.scanDurationMs / 1000).toFixed(1)}s`, "");

  lines.push("## Executive Summary", "");
  lines.push(`Overall Design System Health Score: **${health.overall}/100**`, "");
  lines.push(`- Critical issues: ${health.totalCritical}`);
  lines.push(`- Warnings: ${health.totalWarnings}`);
  lines.push(`- Suggestions: ${health.totalSuggestions}`);
  lines.push(`- Passing checks: ${health.totalSuccesses}`, "");

  lines.push("## Category Scores", "");
  lines.push("| Category | Score | Weight | Critical | Warning | Suggestion |");
  lines.push("|---|---|---|---|---|---|");
  for (const c of health.categories) {
    lines.push(
      `| ${CATEGORY_LABELS[c.category]} | ${c.score} | ${Math.round(c.weight * 100)}% | ${c.criticalCount} | ${c.warningCount} | ${c.suggestionCount} |`
    );
  }
  lines.push("");

  lines.push("## Coverage & Statistics", "");
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  lines.push(`| Total Components | ${stats.totalComponents + stats.totalComponentSets} |`);
  lines.push(`| Total Variants | ${stats.totalVariants} |`);
  lines.push(`| Total Variables | ${stats.totalVariables} |`);
  lines.push(`| Total Tokens | ${stats.totalTokens} |`);
  lines.push(`| Total Styles | ${stats.totalStyles} |`);
  lines.push(`| Total Layers Scanned | ${stats.totalLayers} |`);
  lines.push(`| Deprecated Components | ${stats.deprecatedComponents} |`);
  lines.push(`| Hardcoded Colors | ${tokenStats.hardcodedColorCount} |`);
  lines.push(`| Hardcoded Radii | ${tokenStats.hardcodedRadiusCount} |`);
  lines.push(`| Unused Variables | ${tokenStats.unusedVariableCount} |`);
  lines.push(`| Duplicate Variables | ${tokenStats.duplicateVariableCount} |`, "");

  const MAX_LOCATIONS = 25;

  lines.push("## Issues & Recommendations", "");
  for (const severity of SEVERITY_ORDER) {
    const group = result.issues.filter((i) => i.severity === severity);
    if (group.length === 0) continue;
    lines.push(`### ${severity[0].toUpperCase()}${severity.slice(1)} (${group.length})`, "");

    // Every rule fires once per offending layer, so on a large file the same
    // description/recommendation repeats thousands of times. Group by rule and
    // list occurrences instead, or this section alone runs to hundreds of
    // thousands of lines.
    const byRule = new Map<string, Issue[]>();
    for (const issue of group) {
      const key = issue.ruleId || issue.title;
      const bucket = byRule.get(key);
      if (bucket) bucket.push(issue);
      else byRule.set(key, [issue]);
    }

    for (const occurrences of byRule.values()) {
      const first = occurrences[0];
      const countLabel = occurrences.length === 1 ? "1 occurrence" : `${occurrences.length} occurrences`;
      lines.push(`#### ${first.title} (${countLabel})`, "");
      lines.push(first.description, "");
      lines.push(`- **Why it matters:** ${first.whyItMatters}`);
      lines.push(`- **Recommendation:** ${first.recommendation}`);
      lines.push(`- **Impact:** ${first.estimatedImpact} · **Effort:** ${first.estimatedEffort}`);
      if (first.reference) lines.push(`- **Reference:** ${first.reference}`);

      const locations = occurrences
        .map((i) => (i.node ? i.node.componentName ?? i.node.name : null))
        .filter((name): name is string => Boolean(name));
      if (locations.length > 0) {
        lines.push("- **Affected:**");
        for (const name of locations.slice(0, MAX_LOCATIONS)) {
          lines.push(`  - ${name}`);
        }
        if (locations.length > MAX_LOCATIONS) {
          lines.push(`  - _...and ${locations.length - MAX_LOCATIONS} more_`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
