import { useEffect, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { ChangeListItem } from "@ui/components/ChangeListItem";
import { ChangeDetail } from "@ui/components/ChangeDetail";
import { summarizeChanges } from "@shared/utils/changeSetStats";
import { formatDate } from "@ui/utils/formatDate";

export function ReleasesTab({
  focusReleaseId,
  onFocusConsumed,
}: {
  focusReleaseId?: string;
  onFocusConsumed?: () => void;
} = {}) {
  const { project, send } = useProjectState();
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusReleaseId) return;
    setSelectedReleaseId(focusReleaseId);
    onFocusConsumed?.();
  }, [focusReleaseId]);

  if (!project) return null;
  const releases = [...project.releases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (releases.length === 0) {
    return (
      <div className="state-screen">
        <div className="state-title">No releases yet</div>
        <div className="state-body">Create a release from the Releases tab to start building release history.</div>
      </div>
    );
  }

  const selectedRelease = releases.find((r) => r.id === selectedReleaseId) ?? releases[0];
  const changeSet = project.changeSets.find((cs) => cs.id === selectedRelease?.changeSetId);
  const selectedChange = changeSet?.changes.find((c) => c.id === selectedChangeId) ?? null;

  return (
    <div className="grid" style={{ gridTemplateColumns: "260px 1fr", alignItems: "start", gap: "var(--space-3)" }}>
      <div className="flex flex-col gap-2">
        {releases.map((release) => {
          const cs = project.changeSets.find((c) => c.id === release.changeSetId);
          const stats = summarizeChanges(cs?.changes ?? []);
          const active = selectedRelease?.id === release.id;
          return (
            <button
              key={release.id}
              className="card"
              style={{ textAlign: "left", border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}` }}
              onClick={() => {
                setSelectedReleaseId(release.id);
                setSelectedChangeId(null);
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>v{release.version}</div>
              <div className="text-tertiary" style={{ fontSize: 11.5, marginTop: 2 }}>
                {formatDate(release.createdAt)}
              </div>
              <div className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                {stats.total} change{stats.total === 1 ? "" : "s"}
                {stats.breaking > 0 && <> · {stats.breaking} breaking</>}
                {stats.deprecated > 0 && <> · {stats.deprecated} deprecated</>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
        <div className="flex flex-col gap-2">
          {(changeSet?.changes.length ?? 0) === 0 ? (
            <div className="card state-card">
              <div className="text-secondary">No changes in this release.</div>
            </div>
          ) : (
            changeSet?.changes.map((change) => (
              <ChangeListItem
                key={change.id}
                change={change}
                selected={selectedChangeId === change.id}
                onSelect={setSelectedChangeId}
              />
            ))
          )}
        </div>
        <ChangeDetail
          change={selectedChange}
          changeSetId={changeSet?.id ?? ""}
          onReview={(reviewState) => {
            if (selectedChange && changeSet) {
              send({ type: "update-change", changeSetId: changeSet.id, changeId: selectedChange.id, reviewState });
            }
          }}
        />
      </div>
    </div>
  );
}
