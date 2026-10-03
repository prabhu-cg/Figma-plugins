import React from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { TrackIcon } from "@ui/components/Icons";
import type { PageId } from "@ui/App";
import { getLatestChangeSetForBaseline } from "@shared/utils/changeSets";
import { summarizeChanges } from "@shared/utils/changeSetStats";
import { formatDate } from "@ui/utils/formatDate";


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
  const sinceVersion = latestRelease?.version ?? baseline.version;
  const unreviewed = (changeSet?.changes ?? []).filter((c) => c.reviewState === "unreviewed").length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const leadTitle =
    stats.total === 0
      ? `No changes since v${sinceVersion}`
      : stats.breaking > 0
        ? `${plural(stats.breaking, "breaking change")} since v${sinceVersion}`
        : `${plural(stats.total, "change")} since v${sinceVersion}`;
  const leadSub =
    stats.total === 0
      ? "The last scan found nothing new. Scan again after you edit components or tokens."
      : unreviewed === 0
        ? `All ${stats.total} reviewed — ready to release.`
        : `${unreviewed} of ${stats.total} still unreviewed${stats.deprecated > 0 ? ` · ${stats.deprecated} deprecated` : ""}`;

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
          <button
            className={stats.total === 0 ? "btn btn-primary" : "btn btn-secondary"}
            disabled={scanning}
            onClick={() => send({ type: "scan" })}
          >
            Scan for changes
          </button>
          <button
            className={unreviewed > 0 || stats.total === 0 ? "btn btn-secondary" : "btn btn-primary"}
            onClick={() => onNavigate("releases")}
          >
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
          <div
            className="progress-track"
            style={{ marginBottom: "var(--space-3)" }}
            role="progressbar"
            aria-label="Components scanned"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pctComponents}
          >
            <div className="progress-fill" style={{ transform: `scaleX(${pctComponents / 100})` }} />
          </div>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 12.5 }}>Tokens</span>
            <span className="text-tertiary" style={{ fontSize: 11 }}>
              {scanProgress.tokensDone} / {scanProgress.tokensTotal}
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Tokens scanned"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pctTokens}
          >
            <div className="progress-fill" style={{ transform: `scaleX(${pctTokens / 100})` }} />
          </div>
        </div>
      )}

      <section className="card" aria-labelledby="overview-lead">
        <h2 id="overview-lead" className="lead-title">
          {leadTitle}
        </h2>
        <p className="lead-sub">{leadSub}</p>
        {stats.total > 0 && (
          <div className="flex gap-2" style={{ marginTop: "var(--space-3)" }}>
            <button className="btn btn-primary" onClick={() => onNavigate(unreviewed > 0 ? "changes" : "releases")}>
              {unreviewed > 0 ? "Review changes" : "Create release"}
            </button>
          </div>
        )}
      </section>

      <p className="text-secondary" style={{ marginTop: "var(--space-3)", fontSize: 12.5 }}>
        Tracking {plural(baseline.snapshot.components.length, "component")} and{" "}
        {plural(baseline.snapshot.tokens.length, "token")} · {plural(project.releases.length, "release")} so far
      </p>
    </div>
  );
}
