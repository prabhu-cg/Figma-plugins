import React from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { StatCard } from "@ui/components/Shared";
import { TrackIcon } from "@ui/components/Icons";
import type { PageId } from "@ui/App";
import type { Project } from "@shared/types/project";

function latestChangeSetForBaseline(project: Project, baselineId: string) {
  const sets = project.changeSets.filter((cs) => cs.baselineId === baselineId);
  if (sets.length === 0) return undefined;
  return sets.reduce((latest, cs) => (cs.createdAt > latest.createdAt ? cs : latest));
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

  const changeSet = latestChangeSetForBaseline(project, baseline.id);
  const componentChanges = changeSet?.changes.filter((c) => c.entityType === "component").length ?? 0;
  const tokenChanges = changeSet?.changes.filter((c) => c.entityType === "token").length ?? 0;

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
          <div className="view-subtitle">Current baseline v{baseline.version}</div>
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

      <div className="grid grid-cols-4">
        <StatCard label="Tracked components" value={baseline.snapshot.components.length} />
        <StatCard label="Tracked tokens" value={baseline.snapshot.tokens.length} />
        <StatCard label="Component changes" value={componentChanges} />
        <StatCard label="Token changes" value={tokenChanges} />
      </div>
    </div>
  );
}
