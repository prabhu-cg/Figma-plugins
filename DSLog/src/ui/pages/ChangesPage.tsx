import React, { useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { ChangeListItem } from "@ui/components/ChangeListItem";
import { ChangeDetail } from "@ui/components/ChangeDetail";
import { RenameSuggestionBanner } from "@ui/components/RenameSuggestionBanner";
import { SearchIcon, TrackIcon } from "@ui/components/Icons";
import type { ChangeCategory } from "@shared/types/change";
import type { ReviewState } from "@shared/types/entity";
import { getEffectiveClassification } from "@shared/utils/classification";
import { getLatestChangeSetForBaseline } from "@shared/utils/changeSets";

type EntityFilter = "all" | "components" | "tokens";
type BreakingFilter = "all" | "breaking";
type ReviewFilter = "all" | ReviewState;

const REVIEW_STATE_OPTIONS: ReviewState[] = ["unreviewed", "reviewed", "accepted", "rejected"];

export function ChangesPage() {
  const { project, send } = useProjectState();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ChangeCategory | "all">("all");
  const [entityType, setEntityType] = useState<EntityFilter>("all");
  const [breaking, setBreaking] = useState<BreakingFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<ReviewState>("reviewed");

  const changeSet = useMemo(() => {
    if (!project?.currentBaselineId) return undefined;
    return getLatestChangeSetForBaseline(project, project.currentBaselineId);
  }, [project]);

  const filtered = useMemo(() => {
    if (!changeSet) return [];
    const q = search.trim().toLowerCase();
    return changeSet.changes.filter((c) => {
      const effective = getEffectiveClassification(c);
      if (category !== "all" && effective.category !== category) return false;
      if (entityType === "components" && c.entityType !== "component") return false;
      if (entityType === "tokens" && c.entityType !== "token") return false;
      if (breaking === "breaking" && !effective.breaking && !effective.potentialBreaking) return false;
      if (reviewFilter !== "all" && c.reviewState !== reviewFilter) return false;
      if (q && !`${c.entityName} ${c.summary}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [changeSet, search, category, entityType, breaking, reviewFilter]);

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!project) return null;

  if (!changeSet || changeSet.changes.length === 0) {
    return (
      <div className="state-screen">
        <div className="state-icon">
          <TrackIcon style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">No changes detected</div>
        <div className="state-body">
          Run a scan from the Overview tab after editing components or tokens to see what changed.
        </div>
      </div>
    );
  }

  const componentCount = changeSet.changes.filter((c) => c.entityType === "component").length;
  const tokenCount = changeSet.changes.filter((c) => c.entityType === "token").length;
  const unreviewedCount = changeSet.changes.filter((c) => c.reviewState === "unreviewed").length;
  const reviewedCount = changeSet.changes.filter((c) => c.reviewState !== "unreviewed").length;
  const selected = filtered.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, paddingBottom: 12, marginBottom: 4, borderBottom: "1px solid var(--color-border)" }}>
        <div className="view-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="view-title">Changes</div>
            <div className="view-subtitle">
              {changeSet.changes.length} changes · {componentCount} components · {tokenCount} tokens ·{" "}
              {unreviewedCount} unreviewed · {reviewedCount} reviewed
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 wrap">
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <SearchIcon
              style={{ position: "absolute", left: 10, top: 9, width: 14, height: 14, color: "var(--color-text-tertiary)" }}
            />
            <input
              className="input"
              style={{ paddingLeft: 30, width: "100%" }}
              placeholder="Search changes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="select-wrapper">
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value as ChangeCategory | "all")}>
              <option value="all">All categories</option>
              <option value="added">Added</option>
              <option value="modified">Changed</option>
              <option value="removed">Removed</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </div>
          <div className="select-wrapper">
            <select className="select" value={entityType} onChange={(e) => setEntityType(e.target.value as EntityFilter)}>
              <option value="all">All entities</option>
              <option value="components">Components</option>
              <option value="tokens">Tokens</option>
            </select>
          </div>
          <div className="select-wrapper">
            <select className="select" value={breaking} onChange={(e) => setBreaking(e.target.value as BreakingFilter)}>
              <option value="all">All changes</option>
              <option value="breaking">Breaking only</option>
            </select>
          </div>
          <div className="select-wrapper">
            <select
              className="select"
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value as ReviewFilter)}
            >
              <option value="all">All review states</option>
              {REVIEW_STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state.charAt(0).toUpperCase() + state.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {changeSet.scanSummary.skippedItems.length > 0 && (
          <details style={{ marginTop: 12, fontSize: 11.5 }} className="text-secondary">
            <summary>
              {changeSet.scanSummary.componentsScanned + changeSet.scanSummary.tokensScanned} scanned,{" "}
              {changeSet.scanSummary.skippedItems.length} skipped
            </summary>
            <ul style={{ marginTop: 6, paddingLeft: 16 }}>
              {changeSet.scanSummary.skippedItems.map((item) => (
                <li key={item.id}>
                  {item.name}: {item.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 12 }}>
        <RenameSuggestionBanner changeSetId={changeSet.id} changes={changeSet.changes} />
        {checkedIds.size > 0 && (
          <div className="card flex items-center justify-between wrap gap-2" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{checkedIds.size} selected</span>
            <div className="flex items-center gap-2">
              <div className="select-wrapper">
                <select className="select" value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value as ReviewState)}>
                  {REVIEW_STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                      {state.charAt(0).toUpperCase() + state.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  send({
                    type: "bulk-update-review",
                    changeSetId: changeSet.id,
                    changeIds: Array.from(checkedIds),
                    reviewState: bulkTarget,
                  });
                  setCheckedIds(new Set());
                }}
              >
                Apply
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setCheckedIds(new Set())}>
                Clear
              </button>
            </div>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="card state-card">
            <div className="text-secondary">No changes match these filters.</div>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
            <div className="flex flex-col gap-2" style={{ paddingRight: 4 }}>
              {filtered.map((change) => (
                <ChangeListItem
                  key={change.id}
                  change={change}
                  selected={selectedId === change.id}
                  onSelect={() => setSelectedId(change.id)}
                  checked={checkedIds.has(change.id)}
                  onToggleCheck={() => toggleChecked(change.id)}
                />
              ))}
            </div>
            <ChangeDetail change={selected} changeSetId={changeSet.id} />
          </div>
        )}
      </div>
    </div>
  );
}
