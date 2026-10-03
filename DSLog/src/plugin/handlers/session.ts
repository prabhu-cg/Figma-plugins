import type { Baseline, DesignSystemSnapshot, Project } from "@shared/types/project";
import { loadProject, saveProject } from "@plugin/storage";
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
    session.project = await loadProject();
  }
  return session.project;
}

export async function persist(): Promise<void> {
  await saveProject(session.project);
}

export function findCurrentBaseline(): Baseline | undefined {
  const { project } = session;
  return project.baselines.find((b) => b.id === project.currentBaselineId);
}
