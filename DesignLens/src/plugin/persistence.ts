import type { DesignLensSettings, Issue, IssueStatus, ScanResult, TrendEntry } from "@shared/types";
import { issueKey } from "@shared/util";

const MAX_TREND_ENTRIES = 20;
const SETTINGS_KEY = "designlens:settings";
const DEFAULT_SETTINGS: DesignLensSettings = { wcagLevel: "AA" };
// figma.clientStorage has a hard 5MB quota shared across every key this plugin writes. A huge
// audit's full issue list can exceed that on its own — persistence is a nice-to-have (resume on
// reopen), so it must never be able to take down a completed scan. Every write here is
// best-effort: failures are logged and swallowed, never thrown back at the caller.
const MAX_LAST_RESULT_BYTES = 3_500_000;

const LOCAL_FILE_ID_KEY = "designlens:localFileId";

function generateLocalFileId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// figma.fileKey is only populated once a file is saved/synced to Figma's cloud — local-only or
// not-yet-synced files leave it undefined. figma.root.id is NOT a usable fallback: it's the
// constant "0:0" for every document's root node, not a per-file identifier, so every local file
// would collide on the same clientStorage key and show each other's scan results. Instead, mint
// a random id once and store it as plugin data on the document root — that's saved inside the
// .fig itself, so it stays stable for this specific file across reopens.
function getLocalFileId(): string {
  const existing = figma.root.getPluginData(LOCAL_FILE_ID_KEY);
  if (existing) return existing;
  const id = generateLocalFileId();
  figma.root.setPluginData(LOCAL_FILE_ID_KEY, id);
  return id;
}

/**
 * All persistence is scoped to figma.clientStorage, keyed by file so switching files never
 * bleeds state across documents. This is local-machine storage tied to the user+plugin, not
 * saved into the .fig file itself — it survives closing/reopening the plugin on this machine,
 * but won't follow the file to a teammate's computer.
 */
export function getFileKey(): string {
  return figma.fileKey ?? `local:${getLocalFileId()}`;
}

function scopedKey(fileKey: string, name: string): string {
  return `designlens:${fileKey}:${name}`;
}

async function safeGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await figma.clientStorage.getAsync(key)) as T | undefined;
  } catch (err) {
    console.warn(`DesignLens: failed to read client storage key "${key}":`, err);
    return undefined;
  }
}

async function safeSet(key: string, value: unknown): Promise<boolean> {
  try {
    await figma.clientStorage.setAsync(key, value);
    return true;
  } catch (err) {
    console.warn(`DesignLens: failed to write client storage key "${key}":`, err);
    return false;
  }
}

export async function getSettings(): Promise<DesignLensSettings> {
  const stored = await safeGet<DesignLensSettings>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function setWcagLevel(level: DesignLensSettings["wcagLevel"]): Promise<void> {
  const current = await getSettings();
  await safeSet(SETTINGS_KEY, { ...current, wcagLevel: level });
}

export async function getLastResult(fileKey: string): Promise<ScanResult | null> {
  const stored = await safeGet<ScanResult>(scopedKey(fileKey, "last-result"));
  return stored ?? null;
}

export async function saveLastResult(fileKey: string, result: ScanResult): Promise<void> {
  const serialized = JSON.stringify(result);
  if (serialized.length > MAX_LAST_RESULT_BYTES) {
    console.warn(
      `DesignLens: scan result is ${Math.round(serialized.length / 1e6)}MB, too large to persist locally (5MB quota). ` +
        "Trend history and issue status will still be saved; the full result just won't resume on reopen this session."
    );
    return;
  }
  await safeSet(scopedKey(fileKey, "last-result"), result);
}

export async function getTrend(fileKey: string): Promise<TrendEntry[]> {
  const stored = await safeGet<TrendEntry[]>(scopedKey(fileKey, "trend"));
  return stored ?? [];
}

export async function appendTrend(fileKey: string, entry: TrendEntry): Promise<TrendEntry[]> {
  const existing = await getTrend(fileKey);
  const next = [...existing, entry].slice(-MAX_TREND_ENTRIES);
  await safeSet(scopedKey(fileKey, "trend"), next);
  return next;
}

export async function getIssueStatusMap(fileKey: string): Promise<Record<string, IssueStatus>> {
  const stored = await safeGet<Record<string, IssueStatus>>(scopedKey(fileKey, "issue-status"));
  return stored ?? {};
}

export async function setIssueStatus(fileKey: string, key: string, status: IssueStatus): Promise<Record<string, IssueStatus>> {
  const map = await getIssueStatusMap(fileKey);
  if (status === "open") {
    delete map[key];
  } else {
    map[key] = status;
  }
  await safeSet(scopedKey(fileKey, "issue-status"), map);
  return map;
}

/** Applies persisted resolved/ignored status onto a fresh (or reloaded) issue list, in place. */
export function applyIssueStatuses(issues: Issue[], statusMap: Record<string, IssueStatus>): void {
  for (const issue of issues) {
    issue.status = statusMap[issueKey(issue)] ?? "open";
  }
}

export function buildTrendEntry(result: ScanResult): TrendEntry {
  const categories = {} as TrendEntry["categories"];
  for (const c of result.health.categories) {
    categories[c.category] = c.score;
  }
  return {
    scannedAt: result.scannedAt,
    overall: result.health.overall,
    categories,
    totalCritical: result.health.totalCritical,
    totalWarnings: result.health.totalWarnings,
    totalSuggestions: result.health.totalSuggestions
  };
}
