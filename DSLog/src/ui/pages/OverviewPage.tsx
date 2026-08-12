import React from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { StatCard } from "@ui/components/Shared";
import { TrackIcon } from "@ui/components/Icons";
import type { PageId } from "@ui/App";
import { getLatestChangeSetForBaseline } from "@shared/utils/changeSets";
import { summarizeChanges } from "@shared/utils/changeSetStats";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function OverviewPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { project, send, scanning, scanProgress } = useProjectState();

  if (!project) return null;

  const baseline = project.baselines.find((b) => b.id === project.currentBaselineId);

  if (!baseline) {
    return (
      <div className="state-screen">
        <div className="state-icon">
          <TrackIcon style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">Start tracking your Design System</div>
        <div className="state-body">
          Create your first baseline to start tracking component and token changes.
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate("track")}>
          Create baseline
        </button>
      </div>
    );
  }

  const changeSet = getLatestChangeSetForBaseline(project, baseline.id);
  const stats = summarizeChanges(changeSet?.changes ?? []);

  const latestRelease = [...project.releases].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const pctComponents =
    scanProgress && scanProgress.componentsTotal > 0
      ? Math.min(100, Math.round((scanProgress.componentsDone / scanProgress.componentsTotal) * 100))
      : 0;
  const pctTokens =
    scanProgress && scanProgress.tokensTotal > 0
      ? Math.min(100, Math.round((scanProgress.tokensDone / scanProgress.tokensTotal) * 100))
      : 0;

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Overview</div>
          <div className="view-subtitle">
            {latestRelease
              ? `Current release v${latestRelease.version} · ${formatDate(latestRelease.createdAt)}`
              : `Current baseline v${baseline.version} (unreleased)`}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" disabled={scanning} onClick={() => send({ type: "scan" })}>
            Scan for changes
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate("releases")}>
            Create release
          </button>
        </div>
      </div>

      {scanning && scanProgress && (
        <div className="card" style={{ marginBottom: "var(--space-3)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 12.5 }}>Components</span>
            <span className="text-tertiary" style={{ fontSize: 11 }}>
              {scanProgress.componentsDone} / {scanProgress.componentsTotal}
            </span>
          </div>
          <div className="progress-track" style={{ marginBottom: "var(--space-3)" }}>
            <div className="progress-fill" style={{ width: `${pctComponents}%` }} />
          </div>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 12.5 }}>Tokens</span>
            <span className="text-tertiary" style={{ fontSize: 11 }}>
              {scanProgress.tokensDone} / {scanProgress.tokensTotal}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pctTokens}%` }} />
          </div>
        </div>
      )}

      <div className="card-title" style={{ marginBottom: 8 }}>
        Tracked
      </div>
      <div className="grid grid-cols-3" style={{ marginBottom: "var(--space-3)" }}>
        <StatCard label="Components" value={baseline.snapshot.components.length} />
        <StatCard label="Tokens" value={baseline.snapshot.tokens.length} />
        <StatCard label="Releases" value={project.releases.length} />
      </div>

      <div className="card-title" style={{ marginBottom: 8 }}>
        Since last release
      </div>
      <div className="grid grid-cols-3">
        <StatCard label="Changes" value={stats.total} />
        <StatCard label="Breaking" value={stats.breaking} />
        <StatCard label="Deprecated" value={stats.deprecated} />
      </div>
    </div>
  );
}
