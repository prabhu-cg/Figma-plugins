import React, { useState } from "react";
import { ProjectProvider, useProjectState } from "@ui/state/ProjectContext";
import { Nav } from "@ui/components/Nav";
import { Banner } from "@ui/components/Shared";
import { OverviewPage } from "@ui/pages/OverviewPage";
import { TrackPage } from "@ui/pages/TrackPage";
import { ChangesPage } from "@ui/pages/ChangesPage";
import { ReleasesPage } from "@ui/pages/ReleasesPage";
import { HistoryPage, type HistoryTab } from "@ui/pages/HistoryPage";
import { SettingsPage } from "@ui/pages/SettingsPage";
import { HelpPage } from "@ui/pages/HelpPage";
import { useTheme } from "@ui/state/useTheme";
import type { SearchResult } from "@shared/utils/search";

export type PageId = "overview" | "track" | "changes" | "releases" | "history" | "settings" | "help";

/** Where a picked search result should land: which page, which History tab (if any), and which item to select there. */
interface FocusRequest {
  page: PageId;
  historyTab?: HistoryTab;
  targetId?: string;
}

function focusForResult(result: SearchResult): FocusRequest {
  switch (result.type) {
    case "change":
      return { page: "changes", targetId: result.id };
    case "release":
      return { page: "history", historyTab: "releases", targetId: result.id };
    case "component":
      return { page: "history", historyTab: "components", targetId: result.id };
    case "token":
      return { page: "history", historyTab: "tokens", targetId: result.id };
    case "deprecated":
      return { page: "history", historyTab: "deprecations" };
  }
}

function Shell() {
  const [page, setPage] = useState<PageId>("overview");
  const [focus, setFocus] = useState<FocusRequest | undefined>(undefined);
  const { loading, toasts, dismissToast } = useProjectState();
  useTheme();

  function navigate(id: PageId) {
    setPage(id);
    setFocus(undefined);
  }

  function navigateToResult(result: SearchResult) {
    const request = focusForResult(result);
    setPage(request.page);
    setFocus(request);
  }

  function clearFocus() {
    setFocus(undefined);
  }

  if (loading) {
    return (
      <div className="state-screen">
        <div className="state-title">Loading DSLog…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Nav active={page} onSelect={navigate} onSearchSelect={navigateToResult} />
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
          {page === "overview" && <OverviewPage onNavigate={navigate} />}
          {page === "track" && <TrackPage onNavigate={navigate} />}
          {page === "changes" && (
            <ChangesPage
              focusChangeId={focus?.page === "changes" ? focus.targetId : undefined}
              onFocusConsumed={clearFocus}
            />
          )}
          {page === "releases" && <ReleasesPage onNavigate={navigate} />}
          {page === "history" && (
            <HistoryPage
              focusTab={focus?.page === "history" ? focus.historyTab : undefined}
              focusEntityId={focus?.page === "history" ? focus.targetId : undefined}
              onFocusConsumed={clearFocus}
            />
          )}
          {page === "settings" && <SettingsPage />}
          {page === "help" && <HelpPage />}
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
