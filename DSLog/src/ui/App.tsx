import React, { useState } from "react";
import { ProjectProvider, useProjectState } from "@ui/state/ProjectContext";
import { NavBar } from "@ui/components/NavBar";
import { Toasts } from "@ui/components/Toasts";
import { OverviewPage } from "@ui/pages/OverviewPage";
import { TrackPage } from "@ui/pages/TrackPage";
import { ChangesPage } from "@ui/pages/ChangesPage";
import { ReleasesPage } from "@ui/pages/ReleasesPage";
import { SettingsPage } from "@ui/pages/SettingsPage";

export type PageId = "overview" | "track" | "changes" | "releases" | "settings";

function Shell() {
  const [page, setPage] = useState<PageId>("overview");
  const { loading } = useProjectState();

  if (loading) {
    return <div className="dslog-loading">Loading DSLog…</div>;
  }

  return (
    <div className="dslog-app">
      <NavBar current={page} onNavigate={setPage} />
      <main className="dslog-main">
        {page === "overview" && <OverviewPage onNavigate={setPage} />}
        {page === "track" && <TrackPage onNavigate={setPage} />}
        {page === "changes" && <ChangesPage />}
        {page === "releases" && <ReleasesPage onNavigate={setPage} />}
        {page === "settings" && <SettingsPage />}
      </main>
      <Toasts />
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
