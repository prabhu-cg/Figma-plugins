import { useCallback, useEffect, useState } from "react";
import type { DesignLensSettings, Issue, IssueStatus, PluginToUIMessage, ScanResult, TrendEntry, UIToPluginMessage, WcagLevel } from "@shared/types";
import { issueKey } from "@shared/util";

export type ScanStatus = "idle" | "scanning" | "complete" | "cancelled" | "error";

export interface ScanProgress {
  phase: string;
  processed: number;
  total: number;
}

const DEFAULT_SETTINGS: DesignLensSettings = { wcagLevel: "AA" };

export function postToPlugin(message: UIToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

export function useScan() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState<ScanProgress>({ phase: "", processed: 0, total: 0 });
  const [result, setResult] = useState<ScanResult | null>(null);
  const [trend, setTrend] = useState<TrendEntry[]>([]);
  const [settings, setSettings] = useState<DesignLensSettings>(DEFAULT_SETTINGS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = event.data?.pluginMessage as PluginToUIMessage | undefined;
      if (!message) return;
      switch (message.type) {
        case "init":
          setSettings(message.settings);
          setTrend(message.trend);
          if (message.result) {
            setResult(message.result);
            setStatus("complete");
          }
          break;
        case "scan-progress":
          setProgress({ phase: message.phase, processed: message.processed, total: message.total });
          break;
        case "scan-complete":
          setResult(message.result);
          setTrend(message.trend);
          setStatus("complete");
          break;
        case "scan-cancelled":
          setStatus("cancelled");
          break;
        case "scan-error":
          setErrorMessage(message.message);
          setStatus("error");
          break;
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const startScan = useCallback(() => {
    setStatus("scanning");
    setProgress({ phase: "Starting scan…", processed: 0, total: 1 });
    setErrorMessage(null);
    postToPlugin({ type: "start-scan" });
  }, []);

  const cancelScan = useCallback(() => {
    postToPlugin({ type: "cancel-scan" });
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    postToPlugin({ type: "select-node", nodeId });
  }, []);

  const setWcagLevel = useCallback((level: WcagLevel) => {
    setSettings((prev) => ({ ...prev, wcagLevel: level }));
    postToPlugin({ type: "set-wcag-level", level });
  }, []);

  const setIssueStatus = useCallback((issue: Issue, next: IssueStatus) => {
    setResult((prev) => {
      if (!prev) return prev;
      return { ...prev, issues: prev.issues.map((i) => (i.id === issue.id ? { ...i, status: next } : i)) };
    });
    postToPlugin({ type: "set-issue-status", issueKey: issueKey(issue), status: next });
  }, []);

  return {
    status,
    progress,
    result,
    trend,
    settings,
    errorMessage,
    startScan,
    cancelScan,
    selectNode,
    setWcagLevel,
    setIssueStatus
  };
}
