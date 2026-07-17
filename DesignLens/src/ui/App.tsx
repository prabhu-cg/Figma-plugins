import { useState } from "react";
import { Nav } from "./components/Nav/Nav";
import { ScanGate } from "./components/ScanGate";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { AuditView } from "./components/Views/AuditView";
import { ComponentsView } from "./components/Views/ComponentsView";
import { VariablesView } from "./components/Views/VariablesView";
import { DocumentationView } from "./components/Views/DocumentationView";
import { ReportsView } from "./components/Views/ReportsView";
import { SettingsView } from "./components/Views/SettingsView";
import { useScan } from "./state/useScan";
import { useTheme } from "./state/useTheme";

export type View = "dashboard" | "audit" | "components" | "variables" | "documentation" | "reports" | "settings";

export function App() {
  const scan = useScan();
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<View>("dashboard");

  const hasResult = !!scan.result;

  return (
    <div className="app-shell">
      <Nav active={view} onSelect={setView} disabled={!hasResult} />
      <div style={{ height: "100%", overflow: "hidden" }}>
        {!hasResult && view !== "settings" && (
          <ScanGate
            status={scan.status}
            progress={scan.progress}
            errorMessage={scan.errorMessage}
            onStart={scan.startScan}
            onCancel={scan.cancelScan}
          />
        )}

        {!hasResult && view === "settings" && (
          <SettingsView
            theme={theme}
            onThemeChange={setTheme}
            wcagLevel={scan.settings.wcagLevel}
            onWcagLevelChange={scan.setWcagLevel}
            onRescan={scan.startScan}
            hasResult={false}
          />
        )}

        {hasResult && scan.result && (
          <>
            {scan.status === "scanning" && (
              <RescanBanner
                processed={scan.progress.processed}
                total={scan.progress.total}
                phase={scan.progress.phase}
                onCancel={scan.cancelScan}
              />
            )}
            {view === "dashboard" && (
              <Dashboard result={scan.result} trend={scan.trend} onRescan={scan.startScan} onNavigate={setView} />
            )}
            {view === "audit" && (
              <AuditView result={scan.result} onSelectNode={scan.selectNode} onSetIssueStatus={scan.setIssueStatus} />
            )}
            {view === "components" && <ComponentsView result={scan.result} onSelectNode={scan.selectNode} />}
            {view === "variables" && <VariablesView result={scan.result} />}
            {view === "documentation" && <DocumentationView result={scan.result} onSelectNode={scan.selectNode} />}
            {view === "reports" && <ReportsView result={scan.result} />}
            {view === "settings" && (
              <SettingsView
                theme={theme}
                onThemeChange={setTheme}
                wcagLevel={scan.settings.wcagLevel}
                onWcagLevelChange={scan.setWcagLevel}
                onRescan={scan.startScan}
                hasResult
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RescanBanner({
  processed,
  total,
  phase,
  onCancel
}: {
  processed: number;
  total: number;
  phase: string;
  onCancel: () => void;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: "8px 24px",
        background: "var(--color-primary-soft)",
        borderBottom: "1px solid var(--color-border)"
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>Rescanning… {phase}</span>
      <div className="progress-track" style={{ width: 160 }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
