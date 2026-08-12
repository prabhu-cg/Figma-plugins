import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ChangeSet } from "@shared/types/change";
import type { DiscoveredComponent, ScanProgress } from "@shared/types/scan";
import type { Baseline, Project, Release } from "@shared/types/project";
import type { InstanceScanProgress } from "@shared/types/instance";
import type { UiToPluginMessage } from "@shared/types/messages";
import { onPluginMessage, sendToPlugin } from "./bridge";

interface Toast {
  id: number;
  kind: "error" | "info";
  message: string;
}

interface ProjectState {
  project: Project | undefined;
  loading: boolean;
  scanProgress: ScanProgress | undefined;
  scanning: boolean;
  discovered: DiscoveredComponent[];
  latestChangeSet: ChangeSet | undefined;
  instanceIndexBuilding: boolean;
  instanceIndexProgress: InstanceScanProgress | undefined;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  send: (message: UiToPluginMessage) => void;
  lastBaseline: Baseline | undefined;
  lastRelease: Release | undefined;
  exportContent: { format: "markdown" | "json"; content: string; releaseId: string } | undefined;
  clearExportContent: () => void;
  clearLastBaseline: () => void;
  clearLastRelease: () => void;
}

const ProjectStateContext = createContext<ProjectState | undefined>(undefined);

let toastCounter = 0;

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<Project | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [scanProgress, setScanProgress] = useState<ScanProgress | undefined>(undefined);
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredComponent[]>([]);
  const [latestChangeSet, setLatestChangeSet] = useState<ChangeSet | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastBaseline, setLastBaseline] = useState<Baseline | undefined>(undefined);
  const [lastRelease, setLastRelease] = useState<Release | undefined>(undefined);
  const [instanceIndexBuilding, setInstanceIndexBuilding] = useState(false);
  const [instanceIndexProgress, setInstanceIndexProgress] = useState<InstanceScanProgress | undefined>(undefined);
  const [exportContent, setExportContent] = useState<
    { format: "markdown" | "json"; content: string; releaseId: string } | undefined
  >(undefined);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    toastCounter += 1;
    const id = toastCounter;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = onPluginMessage((message) => {
      switch (message.type) {
        case "state":
          setProject(message.project);
          setLoading(false);
          return;
        case "discovered-components":
          setDiscovered(message.components);
          return;
        case "scan-progress":
          setScanning(message.progress.phase !== "done");
          setScanProgress(message.progress);
          return;
        case "scan-complete":
          setScanning(false);
          setLatestChangeSet(message.changeSet);
          pushToast("info", `Scan complete — ${message.changeSet.changes.length} changes detected.`);
          return;
        case "baseline-created":
          setLastBaseline(message.baseline);
          pushToast("info", `Baseline ${message.baseline.version} created.`);
          return;
        case "release-created":
          setLastRelease(message.release);
          pushToast("info", `Release ${message.release.version} created.`);
          return;
        case "export-result":
          setExportContent({ format: message.format, content: message.content, releaseId: message.releaseId });
          return;
        case "impact-index-progress":
          setInstanceIndexProgress(message.progress);
          return;
        case "impact-index-complete":
          setInstanceIndexBuilding(false);
          setInstanceIndexProgress(undefined);
          pushToast("info", `Impact index built — ${message.index.totalInstancesScanned} instances scanned.`);
          return;
        case "error":
          setScanning(false);
          setInstanceIndexBuilding(false);
          pushToast("error", message.message);
          return;
        default:
          return;
      }
    });

    sendToPlugin({ type: "ui-ready" });
    return unsubscribe;
  }, [pushToast]);

  const send = useCallback((message: UiToPluginMessage) => {
    if (message.type === "scan" || message.type === "create-baseline" || message.type === "create-release") {
      setScanning(true);
      setScanProgress({ phase: "components", componentsTotal: 0, componentsDone: 0, tokensTotal: 0, tokensDone: 0 });
    }
    if (message.type === "build-impact-index") {
      setInstanceIndexBuilding(true);
      setInstanceIndexProgress({ pagesTotal: 0, pagesDone: 0, instancesFound: 0 });
    }
    sendToPlugin(message);
  }, []);

  const clearExportContent = useCallback(() => setExportContent(undefined), []);
  const clearLastBaseline = useCallback(() => setLastBaseline(undefined), []);
  const clearLastRelease = useCallback(() => setLastRelease(undefined), []);

  const value = useMemo<ProjectState>(
    () => ({
      project,
      loading,
      scanProgress,
      scanning,
      discovered,
      latestChangeSet,
      instanceIndexBuilding,
      instanceIndexProgress,
      toasts,
      dismissToast,
      send,
      lastBaseline,
      lastRelease,
      exportContent,
      clearExportContent,
      clearLastBaseline,
      clearLastRelease,
    }),
    [
      project,
      loading,
      scanProgress,
      scanning,
      discovered,
      latestChangeSet,
      instanceIndexBuilding,
      instanceIndexProgress,
      toasts,
      dismissToast,
      send,
      lastBaseline,
      lastRelease,
      exportContent,
      clearExportContent,
      clearLastBaseline,
      clearLastRelease,
    ],
  );

  return <ProjectStateContext.Provider value={value}>{children}</ProjectStateContext.Provider>;
}

export function useProjectState(): ProjectState {
  const ctx = useContext(ProjectStateContext);
  if (!ctx) throw new Error("useProjectState must be used within ProjectProvider");
  return ctx;
}
