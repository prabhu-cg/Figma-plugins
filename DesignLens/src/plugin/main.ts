import type { PluginToUIMessage, UIToPluginMessage } from "@shared/types";
import { registerAllRules } from "./rules";
import { runScan, ScanCancelledError } from "./scanner/scanEngine";
import { findOwningPage } from "./rules/helpers";
import {
  appendTrend,
  applyIssueStatuses,
  buildTrendEntry,
  getFileKey,
  getIssueStatusMap,
  getLastResult,
  getSettings,
  getTrend,
  saveLastResult,
  setIssueStatus,
  setWcagLevel
} from "./persistence";

registerAllRules();

figma.showUI(__html__, { width: 1180, height: 760, themeColors: true });

let cancelled = false;
const fileKey = getFileKey();

function post(message: PluginToUIMessage): void {
  figma.ui.postMessage(message);
}

async function focusNode(nodeId: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.removed || !("visible" in node)) return;
  const scene = node as SceneNode;
  const page = findOwningPage(scene);
  if (page) await figma.setCurrentPageAsync(page);
  figma.currentPage.selection = [scene];
  figma.viewport.scrollAndZoomIntoView([scene]);
}

async function handleInit(): Promise<void> {
  const [settings, lastResult, trend, statusMap] = await Promise.all([
    getSettings(),
    getLastResult(fileKey),
    getTrend(fileKey),
    getIssueStatusMap(fileKey)
  ]);
  if (lastResult) applyIssueStatuses(lastResult.issues, statusMap);
  post({ type: "init", settings, result: lastResult, trend });
}

async function handleStartScan(): Promise<void> {
  cancelled = false;
  try {
    const settings = await getSettings();
    const result = await runScan(
      (phase, processed, total) => post({ type: "scan-progress", phase, processed, total }),
      () => cancelled,
      settings.wcagLevel
    );

    const statusMap = await getIssueStatusMap(fileKey);
    applyIssueStatuses(result.issues, statusMap);

    await saveLastResult(fileKey, result);
    const trend = await appendTrend(fileKey, buildTrendEntry(result));

    post({ type: "scan-complete", result, trend });
  } catch (err) {
    if (err instanceof ScanCancelledError) {
      post({ type: "scan-cancelled" });
    } else {
      post({ type: "scan-error", message: err instanceof Error ? err.message : String(err) });
    }
  }
}

figma.ui.onmessage = async (message: UIToPluginMessage) => {
  switch (message.type) {
    case "start-scan":
      await handleStartScan();
      break;
    case "cancel-scan":
      cancelled = true;
      break;
    case "select-node":
      await focusNode(message.nodeId);
      break;
    case "set-wcag-level":
      await setWcagLevel(message.level);
      break;
    case "set-issue-status":
      await setIssueStatus(fileKey, message.issueKey, message.status);
      break;
  }
};

void handleInit();
