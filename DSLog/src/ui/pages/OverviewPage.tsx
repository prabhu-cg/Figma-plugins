import React from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { Wordmark } from "@ui/components/Wordmark";
import { Button } from "@ui/components/Button";
import { ProgressBar } from "@ui/components/ProgressBar";
import { EmptyState } from "@ui/components/EmptyState";
import type { PageId } from "@ui/App";

function latestChangeSetForBaseline(project: NonNullable<ReturnType<typeof useProjectState>["project"]>, baselineId: string) {
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
      <div className="dslog-page">
        <header className="dslog-header">
          <Wordmark withTagline size="lg" />
        </header>
        <EmptyState
          title="Start tracking your Design System"
          description="Create your first baseline to start tracking component and token changes."
          action={
            <Button variant="primary" onClick={() => onNavigate("track")}>
              Create baseline
            </Button>
          }
        />
      </div>
    );
  }

  const changeSet = latestChangeSetForBaseline(project, baseline.id);
  const componentChanges = changeSet?.changes.filter((c) => c.entityType === "component").length ?? 0;
  const tokenChanges = changeSet?.changes.filter((c) => c.entityType === "token").length ?? 0;

  return (
    <div className="dslog-page">
      <header className="dslog-header">
        <Wordmark withTagline size="lg" />
      </header>

      <section className="dslog-card">
        <div className="dslog-label">Current baseline</div>
        <div className="dslog-value dslog-value--lg">v{baseline.version}</div>
      </section>

      <section className="dslog-card">
        <div className="dslog-label">Tracked</div>
        <div className="dslog-stat-row">
          <div>
            <div className="dslog-stat-num">{baseline.snapshot.components.length}</div>
            <div className="dslog-stat-name">Components</div>
          </div>
          <div>
            <div className="dslog-stat-num">{baseline.snapshot.tokens.length}</div>
            <div className="dslog-stat-name">Tokens</div>
          </div>
        </div>
      </section>

      <section className="dslog-card">
        <div className="dslog-label">Changes</div>
        <div className="dslog-stat-row">
          <div>
            <div className="dslog-stat-num">{componentChanges}</div>
            <div className="dslog-stat-name">Components</div>
          </div>
          <div>
            <div className="dslog-stat-num">{tokenChanges}</div>
            <div className="dslog-stat-name">Tokens</div>
          </div>
        </div>
      </section>

      {scanning && scanProgress && (
        <section className="dslog-card">
          <ProgressBar label="Components" done={scanProgress.componentsDone} total={scanProgress.componentsTotal} />
          <ProgressBar label="Tokens" done={scanProgress.tokensDone} total={scanProgress.tokensTotal} />
        </section>
      )}

      <div className="dslog-actions">
        <Button variant="secondary" disabled={scanning} onClick={() => send({ type: "scan" })}>
          Scan for changes
        </Button>
        <Button variant="primary" onClick={() => onNavigate("releases")}>
          Create release
        </Button>
      </div>
    </div>
  );
}
