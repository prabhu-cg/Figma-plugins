import React, { useState } from "react";
import { ProjectProvider, useProjectState } from "@ui/state/ProjectContext";
import { Nav } from "@ui/components/Nav";
import { Banner } from "@ui/components/Shared";
import { OverviewPage } from "@ui/pages/OverviewPage";
import { TrackPage } from "@ui/pages/TrackPage";
import { ChangesPage } from "@ui/pages/ChangesPage";
import { ReleasesPage } from "@ui/pages/ReleasesPage";
import { HistoryPage } from "@ui/pages/HistoryPage";
import { SettingsPage } from "@ui/pages/SettingsPage";
import { useTheme } from "@ui/state/useTheme";

export type PageId = "overview" | "track" | "changes" | "releases" | "history" | "settings";

function Shell() {
  const [page, setPage] = useState<PageId>("overview");
  const { loading, toasts, dismissToast } = useProjectState();
  useTheme();

  if (loading) {
    return (
      <div className="state-screen">
        <div className="state-title">Loading DSLog…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Nav active={page} onSelect={setPage} />
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {toasts.length > 0 && (
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            {toasts.map((toast) => (
              <Banner key={toast.id} kind={toast.kind} onDismiss={() => dismissToast(toast.id)}>
                {toast.message}
              </Banner>
            ))}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          {page === "overview" && <OverviewPage onNavigate={setPage} />}
          {page === "track" && <TrackPage onNavigate={setPage} />}
          {page === "changes" && <ChangesPage />}
          {page === "releases" && <ReleasesPage onNavigate={setPage} />}
          {page === "history" && <HistoryPage />}
          {page === "settings" && <SettingsPage />}
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}
