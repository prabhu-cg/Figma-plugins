import { useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { Banner } from "@ui/components/Shared";
import { Tabs, tabId, tabPanelId } from "@ui/components/Tabs";
import { TrackIcon } from "@ui/components/Icons";
import { useDismissOnce } from "@ui/state/useDismissOnce";
import type { PageId } from "@ui/App";
import { useReleaseDraft } from "./releases/useReleaseDraft";
import { CreateReleaseTab } from "./releases/CreateReleaseTab";
import { PastReleasesTab } from "./releases/PastReleasesTab";
import { ReleaseFooter } from "./releases/ReleaseFooter";

type Tab = "create" | "past";

export function ReleasesPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { project, lastRelease } = useProjectState();
  const [tab, setTab] = useState<Tab>("create");
  const [explainerDismissed, dismissExplainer] = useDismissOnce("releases-explainer");
  const draft = useReleaseDraft();

  if (!project) return null;

  if (!project.currentBaselineId) {
    return (
      <div className="state-screen">
        <div className="state-icon">
          <TrackIcon style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">No baseline yet</div>
        <div className="state-body">Create a baseline before creating a release.</div>
        <button className="btn btn-primary" onClick={() => onNavigate("track")}>
          Create baseline
        </button>
      </div>
    );
  }

  const pendingCount = draft.changesSinceRelease.length;
  const showFooter = tab === "create" && !lastRelease;

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ flex: "1 1 auto" }}>
        <div className="view-header">
          <div>
            <div className="view-title">Releases</div>
            <div className="view-subtitle">Bundle reviewed changes into a named version with a changelog</div>
          </div>
        </div>

        {!explainerDismissed && (
          <Banner kind="info" style={{ marginBottom: "var(--space-3)" }} onDismiss={dismissExplainer}>
            A release packages everything changed since your current baseline into a versioned changelog, then
            becomes the new baseline — so your next scan compares against this point going forward.
          </Banner>
        )}

        {tab === "create" && !lastRelease && pendingCount > 0 && (
          <Banner kind="info" style={{ marginBottom: "var(--space-3)" }}>
            {pendingCount} change{pendingCount === 1 ? "" : "s"} since your last release.
          </Banner>
        )}

        <Tabs
          idPrefix="releases"
          tabs={[
            { id: "create", label: "Create release" },
            { id: "past", label: `Past releases${project.releases.length > 0 ? ` (${project.releases.length})` : ""}` },
          ]}
          active={tab}
          onChange={setTab}
        />

        <div role="tabpanel" id={tabPanelId("releases", tab)} aria-labelledby={tabId("releases", tab)}>
          {tab === "create" && <CreateReleaseTab draft={draft} onViewChangelog={() => setTab("past")} />}
          {tab === "past" && <PastReleasesTab />}
        </div>
      </div>

      {showFooter && <ReleaseFooter draft={draft} />}
    </div>
  );
}
