import { useState } from "react";
import type { ScanResult } from "@shared/types";
import { DownloadIcon } from "../Icons";
import { downloadFile, safeFileBase } from "../../export/download";
import { buildJsonReport } from "../../export/toJson";
import { buildMarkdownReport } from "../../export/toMarkdown";
import { Gauge } from "../Charts/Gauge";
import { Donut } from "../Charts/Donut";
import { LegendRow, StatCard } from "../Shared";

interface ReportsViewProps {
  result: ScanResult;
}

type ExportFormat = "markdown" | "json";

export function ReportsView({ result }: ReportsViewProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const base = safeFileBase(result.fileName);

  async function handleExport(format: ExportFormat) {
    setBusy(format);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (format === "json") downloadFile(await buildJsonReport(result), `${base}-designlens.json`, "application/json");
      if (format === "markdown") downloadFile(buildMarkdownReport(result), `${base}-designlens.md`, "text/markdown");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Reports</div>
          <div className="view-subtitle">Export the full audit as a shareable report</div>
        </div>
      </div>

      <div className="grid grid-cols-2" style={{ marginBottom: 24 }}>
        <ExportCard
          format="markdown"
          title="Markdown"
          description="Readable report for READMEs, wikis, or PR descriptions."
          busy={busy === "markdown"}
          onExport={handleExport}
        />
        <ExportCard
          format="json"
          title="JSON"
          description="Full raw scan output for custom tooling or CI checks."
          busy={busy === "json"}
          onExport={handleExport}
        />
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>
          Executive Summary Preview
        </div>
        <div className="grid" style={{ gridTemplateColumns: "240px 1fr", alignItems: "start", gap: 24 }}>
          <div className="flex" style={{ flexDirection: "column", alignItems: "center", gap: 20 }}>
            <Gauge score={result.health.overall} label="Health Score" size={220} />
            <Donut
              segments={[
                { label: "Critical", value: result.health.totalCritical, color: "var(--color-critical)" },
                { label: "Warning", value: result.health.totalWarnings, color: "var(--color-warning)" },
                { label: "Suggestion", value: result.health.totalSuggestions, color: "var(--color-suggestion)" }
              ]}
              size={200}
              thickness={22}
              centerLabel={`${result.issues.length}`}
              centerSub="issues"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 10 }}>
                Severity Distribution
              </div>
              <div className="grid grid-cols-4" style={{ rowGap: 8, columnGap: 24 }}>
                <LegendRow color="var(--color-critical)" label="Critical" value={result.health.totalCritical} />
                <LegendRow color="var(--color-warning)" label="Warning" value={result.health.totalWarnings} />
                <LegendRow color="var(--color-suggestion)" label="Suggestion" value={result.health.totalSuggestions} />
                <LegendRow color="var(--color-success)" label="Passing checks" value={result.health.totalSuccesses} />
              </div>
            </div>
            <div className="grid grid-cols-4" style={{ rowGap: 16 }}>
              <StatCard label="Components Audited" value={result.stats.totalComponents + result.stats.totalComponentSets} />
              <StatCard label="Variants" value={result.stats.totalVariants} />
              <StatCard label="Variables" value={result.stats.totalVariables} />
              <StatCard
                label="Tokens"
                value={result.stats.totalTokens}
                sub={`${result.stats.totalVariables} variables + ${result.stats.totalStyles} styles`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportCard({
  format,
  title,
  description,
  busy,
  onExport
}: {
  format: ExportFormat;
  title: string;
  description: string;
  busy: boolean;
  onExport: (format: ExportFormat) => void;
}) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontWeight: 800, fontSize: 14 }}>{title}</span>
        <DownloadIcon style={{ width: 16, height: 16, color: "var(--color-text-tertiary)" }} />
      </div>
      <div className="text-secondary" style={{ fontSize: 12, flex: 1 }}>
        {description}
      </div>
      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onExport(format)}>
        {busy ? "Exporting…" : `Export ${title}`}
      </button>
    </div>
  );
}
