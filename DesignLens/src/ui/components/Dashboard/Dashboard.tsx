import { useMemo, useState } from "react";
import type { AuditCategory, ScanResult, Severity, TrendEntry } from "@shared/types";
import { CATEGORY_LABELS } from "@shared/types";
import { Gauge } from "../Charts/Gauge";
import { Donut } from "../Charts/Donut";
import { Sparkline } from "../Charts/Sparkline";
import { StackedBarList, type StackedBarItem } from "../Charts/StackedBarList";
import { LegendRow, ScoreBar, StatCard, TrendBadge } from "../Shared";
import { Tabs } from "../Tabs";
import { computeDashboardMetrics } from "../../lib/metrics";
import type { View } from "../../App";

interface DashboardProps {
  result: ScanResult;
  trend: TrendEntry[];
  onRescan: () => void;
  onNavigate: (view: View) => void;
}

type DashboardTab = "categories" | "breakdown" | "coverage" | "inventory";

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "categories", label: "Category Scores" },
  { id: "breakdown", label: "Issue Breakdown" },
  { id: "coverage", label: "Coverage" },
  { id: "inventory", label: "Inventory" }
];

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--color-critical)",
  warning: "var(--color-warning)",
  suggestion: "var(--color-suggestion)"
};

function emptySeverityCounts(): Record<Severity, number> {
  return { critical: 0, warning: 0, suggestion: 0 };
}

function toStackedItem(label: string, counts: Record<Severity, number>): StackedBarItem {
  return {
    label,
    segments: [
      { value: counts.critical, color: SEVERITY_COLOR.critical },
      { value: counts.warning, color: SEVERITY_COLOR.warning },
      { value: counts.suggestion, color: SEVERITY_COLOR.suggestion }
    ]
  };
}

export function Dashboard({ result, trend, onRescan, onNavigate }: DashboardProps) {
  const [tab, setTab] = useState<DashboardTab>("categories");
  const metrics = computeDashboardMetrics(result);
  const { stats, health } = result;
  const scannedAt = new Date(result.scannedAt);

  const sortedCategories = [...health.categories].sort((a, b) => b.weight - a.weight);
  const previousEntry = trend.length >= 2 ? trend[trend.length - 2] : null;
  const overallDelta = previousEntry ? health.overall - previousEntry.overall : null;

  const moduleBreakdown = useMemo(() => {
    const map = new Map<AuditCategory, Record<Severity, number>>();
    for (const issue of result.issues) {
      const counts = map.get(issue.category) ?? emptySeverityCounts();
      counts[issue.severity] += 1;
      map.set(issue.category, counts);
    }
    return Array.from(map.entries()).map(([category, counts]) => toStackedItem(CATEGORY_LABELS[category], counts));
  }, [result.issues]);

  const topComponents = useMemo(() => {
    const map = new Map<string, { name: string; counts: Record<Severity, number> }>();
    for (const issue of result.issues) {
      if (!issue.node?.componentId) continue;
      const entry = map.get(issue.node.componentId) ?? {
        name: issue.node.componentName ?? issue.node.name,
        counts: emptySeverityCounts()
      };
      entry.counts[issue.severity] += 1;
      map.set(issue.node.componentId, entry);
    }
    return Array.from(map.values())
      .map((entry) => toStackedItem(entry.name, entry.counts))
      .sort((a, b) => b.segments.reduce((s, x) => s + x.value, 0) - a.segments.reduce((s, x) => s + x.value, 0))
      .slice(0, 10);
  }, [result.issues]);

  const coverageItems = [
    { label: "Accessibility Score", score: metrics.accessibilityScore },
    { label: "Token Coverage", score: metrics.tokenCoverage },
    { label: "Documentation Coverage", score: metrics.documentationCoverage },
    { label: "Component Coverage", score: metrics.componentCoverage },
    { label: "Naming Consistency", score: metrics.namingConsistency },
    { label: "Typography Score", score: metrics.typographyScore },
    { label: "Spacing Score", score: metrics.spacingScore },
    { label: "Variant Coverage", score: metrics.variantCoverage },
    { label: "State Coverage", score: metrics.stateCoverage }
  ];

  const inventoryItems = [
    { label: "Total Components", value: stats.totalComponents + stats.totalComponentSets },
    { label: "Total Variants", value: stats.totalVariants },
    { label: "Total Variables", value: stats.totalVariables },
    {
      label: "Total Tokens",
      value: stats.totalTokens,
      sub: `${stats.totalVariables} variables + ${stats.totalStyles} styles`
    },
    { label: "Total Styles", value: stats.totalStyles },
    { label: "Total Layers Scanned", value: stats.totalLayers.toLocaleString() },
    { label: "Deprecated Components", value: stats.deprecatedComponents }
  ];

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Design System Health</div>
          <div className="view-subtitle">
            {result.fileName} · scanned {scannedAt.toLocaleString()} · {(stats.scanDurationMs / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("reports")}>
            Export report
          </button>
          <button className="btn btn-primary btn-sm" onClick={onRescan}>
            Rescan
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto",
          alignItems: "center",
          gap: 24,
          marginBottom: "var(--space-3)"
        }}
      >
        <div className="flex" style={{ flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Gauge score={health.overall} label="Health Score" size={150} />
          <TrendBadge delta={overallDelta} />
        </div>
        <div className="flex gap-2 wrap">
          <span className="badge badge-critical">{health.totalCritical} critical</span>
          <span className="badge badge-warning">{health.totalWarnings} warnings</span>
          <span className="badge badge-suggestion">{health.totalSuggestions} suggestions</span>
          <span className="badge badge-success">{health.totalSuccesses} passing</span>
        </div>
        <div style={{ width: 1, height: 64, background: "var(--color-border)" }} />
        <div style={{ width: 220 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>
            Health Trend
          </div>
          <Sparkline values={trend.map((t) => t.overall)} width={220} height={56} />
          <div className="text-tertiary" style={{ fontSize: 11, marginTop: 6 }}>
            {trend.length > 0
              ? `Last ${trend.length} scan${trend.length === 1 ? "" : "s"}`
              : "Scan again to start tracking trend"}
          </div>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "categories" && (
        <div className="card">
          <div className="grid grid-cols-2" style={{ rowGap: 16, columnGap: 32 }}>
            {sortedCategories.map((c) => (
              <ScoreBar
                key={c.category}
                label={CATEGORY_LABELS[c.category]}
                score={c.score}
                delta={previousEntry ? c.score - previousEntry.categories[c.category] : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {tab === "breakdown" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div className="grid grid-cols-2">
            <div
              className="card flex"
              style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}
            >
              <Donut
                segments={[
                  { label: "Critical", value: health.totalCritical, color: "var(--color-critical)" },
                  { label: "Warning", value: health.totalWarnings, color: "var(--color-warning)" },
                  { label: "Suggestion", value: health.totalSuggestions, color: "var(--color-suggestion)" }
                ]}
                size={220}
                thickness={24}
                centerLabel={`${result.issues.length}`}
                centerSub="issues"
              />
              <div style={{ width: "100%", maxWidth: 280 }}>
                <div className="card-title" style={{ marginBottom: 10, textAlign: "center" }}>
                  Severity Distribution
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <LegendRow color="var(--color-critical)" label="Critical" value={health.totalCritical} />
                  <LegendRow color="var(--color-warning)" label="Warning" value={health.totalWarnings} />
                  <LegendRow color="var(--color-suggestion)" label="Suggestion" value={health.totalSuggestions} />
                  <LegendRow color="var(--color-success)" label="Passing checks" value={health.totalSuccesses} />
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div className="card-title">Issues by Module</div>
                <SeverityLegend />
              </div>
              <StackedBarList items={moduleBreakdown} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div className="card-title">Top 10 Components by Issue Count</div>
              <SeverityLegend />
            </div>
            {topComponents.length > 0 ? (
              <StackedBarList items={topComponents} />
            ) : (
              <div className="text-secondary" style={{ fontSize: 12.5 }}>
                No issues are tied to a specific component.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "coverage" && (
        <div className="card">
          <div className="grid grid-cols-2" style={{ rowGap: 16, columnGap: 32 }}>
            {coverageItems.map((item) => (
              <ScoreBar
                key={item.label}
                label={item.label}
                score={item.score}
                right={`${item.score}${item.label.includes("Score") ? "" : "%"}`}
              />
            ))}
          </div>
        </div>
      )}

      {tab === "inventory" && (
        <div className="grid grid-cols-4">
          {inventoryItems.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} sub={item.sub} />
          ))}
        </div>
      )}
    </div>
  );
}

function SeverityLegend() {
  return (
    <div className="flex items-center gap-3">
      {(["critical", "warning", "suggestion"] as Severity[]).map((s) => (
        <span key={s} className="flex items-center gap-1" style={{ fontSize: 11 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: SEVERITY_COLOR[s], display: "inline-block" }} />
          <span className="text-tertiary" style={{ textTransform: "capitalize" }}>
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}
