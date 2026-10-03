import type { Baseline, DesignSystemSnapshot, Project } from "@shared/types/project";
import { loadProject, saveProject } from "@plugin/storage";
import { postToUi } from "@plugin/utils/postMessage";
import { pruneStaleChangeSets } from "@shared/utils/changeSets";
import type { ScanSummary } from "./scanSupport";

/**
 * Mutable state shared by every handler. Held on one object (rather than as
 * module-level `let`s) so the rollback in `handleMessage` can swap `project`
 * back and all handlers see it.
 */
export interface Session {
  project: Project;
  /** Last scan result, so "create release" can promote it without re-scanning. */
  latestScannedSnapshot: DesignSystemSnapshot | undefined;
  latestScanSummary: ScanSummary | undefined;
}

export const session: Session = {
  project: undefined as unknown as Project,
  latestScannedSnapshot: undefined,
  latestScanSummary: undefined,
};

export async function ensureProject(): Promise<Project> {
  if (!session.project) {
    const loaded = await loadProject();
    // Older versions kept every superseded scan forever; drop them once, and let the next save record that.
    const pruned = pruneStaleChangeSets(loaded);
    session.project = pruned;
    if (pruned !== loaded) schedulePersist();
  }
  return session.project;
}

// Save requests are coalesced: while a save is running, further requests don't start their own — they are
// answered by one more save, run right after it, which serialises the newest state. A burst of review
// actions therefore costs two saves, not one per key press.
let requested = 0;
let saved = 0;
let running: Promise<void> | undefined;

async function drain(): Promise<void> {
  while (saved < requested) {
    const target = requested;
    await saveProject(session.project);
    saved = target;
  }
}

/**
 * Resolves once a save that includes everything changed so far has finished, and rejects if it could not be
 * written. Handlers that must not report success before the data is safe (baselines, releases, scans) await this.
 */
export function persist(): Promise<void> {
  // A save requested now includes anything that was waiting out its delay.
  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  requested++;
  if (!running) {
    running = drain().finally(() => {
      running = undefined;
    });
  }
  return running;
}

// Background saves wait briefly so a burst of edits (holding A, working down a list) is saved once, not once per
// key press. The wait is capped, so a continuous burst still reaches storage about once a second.
let debounceMs = 120;
const MAX_WAIT_MS = 1000;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let debounceStartedAt = 0;

/** Tests use 0 (save immediately) so they don't have to wait out the delay. */
export function setPersistDebounce(ms: number): void {
  debounceMs = ms;
}

function reportSaveFailure(error: unknown): void {
  postToUi({
    type: "error",
    message: `Couldn't save your latest changes (${error instanceof Error ? error.message : "unknown error"}). They're kept for now and will be saved with your next change.`,
  });
}

/**
 * For high-frequency edits (review decisions): the in-memory project is already the truth and the UI has
 * already been told, so the save runs shortly afterwards in the background. If it fails, the user is told and
 * nothing is lost for this session — the change stays in memory and the next save retries it.
 */
export function schedulePersist(): void {
  if (debounceMs <= 0) {
    persist().catch(reportSaveFailure);
    return;
  }
  const now = Date.now();
  if (debounceTimer === undefined) debounceStartedAt = now;
  else clearTimeout(debounceTimer);
  const wait = Math.max(0, Math.min(debounceMs, MAX_WAIT_MS - (now - debounceStartedAt)));
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    persist().catch(reportSaveFailure);
  }, wait);
}

/** Saves anything still waiting out its delay right now (used when the plugin is closing). */
export function flushScheduledPersist(): void {
  if (debounceTimer === undefined) return;
  clearTimeout(debounceTimer);
  debounceTimer = undefined;
  persist().catch(reportSaveFailure);
}

export function findCurrentBaseline(): Baseline | undefined {
  const { project } = session;
  return project.baselines.find((b) => b.id === project.currentBaselineId);
}
