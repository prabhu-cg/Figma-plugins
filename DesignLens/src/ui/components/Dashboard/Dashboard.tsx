import { useMemo, useState } from "react";
import type { AuditCategory, ScanResult, Severity, TrendEntry } from "@shared/types";
import { CATEGORY_LABELS } from "@shared/types";
import { Gauge } from "../Charts/Gauge";
import { Donut } from "../Charts/Donut";
import { Sparkline } from "../Charts/Sparkline";
import { StackedBarList, type StackedBarItem } from "../Charts/StackedBarList";
import { LegendRow, ScoreBar, scoreColors, StatCard, TrendBadge } from "../Shared";
import { PriorityStrip } from "./PriorityStrip";
import { ScoreExplainer } from "./ScoreExplainer";
import { Tabs, tabPanelProps } from "../Tabs";
import { computeDashboardMetrics } from "../../lib/metrics";
import type { View } from "../../App";

interface DashboardProps {
  result: ScanResult;
  trend: TrendEntry[];
  onRescan: () => void;
  onNavigate: (view: View) => void;
  /** Opens Audit filtered to one category. */
  onReviewCategory: (category: AuditCategory) => void;
  isScanning?: boolean;
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

export function Dashboard({ result, trend, onRescan, onNavigate, onReviewCategory, isScanning = false }: DashboardProps) {
  const [tab, setTab] = useState<DashboardTab>("categories");
  const metrics = useMemo(() => computeDashboardMetrics(result), [result]);
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

  // Nine bars in one list is more than anyone scans; three themed groups of three, worst first.
  const coverageGroups = [
    {
      title: "Foundations",
      items: [
        { label: "Token Coverage", score: metrics.tokenCoverage },
        { label: "Typography Score", score: metrics.typographyScore },
        { label: "Spacing Score", score: metrics.spacingScore }
      ]
    },
    {
      title: "Components",
      items: [
        { label: "Component Coverage", score: metrics.componentCoverage },
        { label: "Variant Coverage", score: metrics.variantCoverage },
        { label: "State Coverage", score: metrics.stateCoverage }
      ]
    },
    {
      title: "Quality and docs",
      items: [
        { label: "Accessibility Score", score: metrics.accessibilityScore },
        { label: "Documentation Coverage", score: metrics.documentationCoverage },
        { label: "Naming Consistency", score: metrics.namingConsistency }
      ]
    }
  ].map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.score - b.score) }));

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
            View reports
          </button>
          <button className="btn btn-primary btn-sm" onClick={onRescan} disabled={isScanning} aria-busy={isScanning}>
            {isScanning && <span className="spinner" aria-hidden="true" />}
            {isScanning ? "Rescanning…" : "Rescan"}
          </button>
        </div>
      </div>

      <div className="card health-card">
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
        <div className="health-divider" />
        <div className="health-trend">
          <div className="card-title" style={{ marginBottom: 8 }}>
            Health Trend
          </div>
          <Sparkline values={trend.map((t) => t.overall)} width={220} height={56} color={scoreColors(health.overall).fill} />
          <div className="text-tertiary" style={{ fontSize: "var(--text-xs)", marginTop: 6 }}>
            {trend.length > 0
              ? `Last ${trend.length} scan${trend.length === 1 ? "" : "s"}`
              : "Scan again to start tracking trend"}
          </div>
        </div>
      </div>

      <PriorityStrip result={result} onReview={onReviewCategory} />
      <ScoreExplainer health={health} />

      <Tabs tabs={TABS} active={tab} onChange={setTab} idPrefix="dash" label="Dashboard sections" />

      {tab === "categories" && (
        <div className="card" {...tabPanelProps("dash", "categories")}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} {...tabPanelProps("dash", "breakdown")}>
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
              <div className="text-secondary" style={{ fontSize: "var(--text-base)" }}>
                No issues are tied to a specific component.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "coverage" && (
        <div className="coverage-grid" {...tabPanelProps("dash", "coverage")}>
          {coverageGroups.map((group) => (
            <div key={group.title} className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card-title">{group.title}</div>
              {group.items.map((item) => (
                <ScoreBar
                  key={item.label}
                  label={item.label}
                  score={item.score}
                  right={`${item.score}${item.label.includes("Score") ? "" : "%"}`}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "inventory" && (
        <div className="grid grid-cols-4" {...tabPanelProps("dash", "inventory")}>
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
        <span key={s} className="flex items-center gap-1" style={{ fontSize: "var(--text-xs)" }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: SEVERITY_COLOR[s], display: "inline-block" }} />
          <span className="text-tertiary" style={{ textTransform: "capitalize" }}>
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}
