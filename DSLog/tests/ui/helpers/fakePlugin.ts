import type { Project } from "@shared/types/project";
import type { Release } from "@shared/types/project";
import type { ChangePatch } from "@shared/types/messages";
import { applyChangePatches } from "@shared/utils/changePatches";
import { bridge } from "./bridge";

/**
 * A minimal plugin side for UI tests: applies the review and release messages to a project the way
 * `src/plugin/handlers` does, then answers with the same messages the real plugin sends. Anything it
 * doesn't know is just recorded in `bridge.sent`.
 */
export function installFakePlugin(project: Project) {
  const state = { project };
  const emitState = () => bridge.emit({ type: "state", project: structuredClone(state.project) });

  bridge.onSend = (message) => {
    const changeSet = () => state.project.changeSets.find((cs) => "changeSetId" in message && cs.id === message.changeSetId);
    switch (message.type) {
      case "ui-ready":
      case "get-state":
        emitState();
        return;
      case "update-change": {
        const patch: ChangePatch = { changeId: message.changeId };
        if (message.reviewState !== undefined) patch.reviewState = message.reviewState;
        if (message.reviewNote !== undefined) patch.reviewNote = message.reviewNote;
        if (message.migrationNote !== undefined) patch.migrationNote = message.migrationNote;
        if (message.manualClassification !== undefined) patch.manualClassification = message.manualClassification;
        state.project = applyChangePatches(state.project, message.changeSetId, [patch]);
        bridge.emit({ type: "changes-updated", changeSetId: message.changeSetId, patches: [patch] });
        return;
      }
      case "bulk-update-review": {
        const ids = new Set(message.changeIds);
        const patches: ChangePatch[] = (changeSet()?.changes ?? [])
          .filter((c) => ids.has(c.id))
          .map((c) => ({ changeId: c.id, reviewState: message.reviewState }));
        state.project = applyChangePatches(state.project, message.changeSetId, patches);
        bridge.emit({ type: "changes-updated", changeSetId: message.changeSetId, patches });
        return;
      }
      case "create-release": {
        const release: Release = {
          id: `release-${state.project.releases.length + 1}`,
          version: message.version,
          title: message.title,
          description: message.description,
          baselineId: "baseline-new",
          changeSetId: "changeset-1",
          include: message.include,
          changelogMarkdown: `# ${message.version} — ${message.title}`,
          changelogJson: "{}",
          createdAt: "2026-03-01T00:00:00.000Z",
        };
        state.project.releases.push(release);
        bridge.emit({ type: "release-created", release });
        emitState();
        return;
      }
      case "export": {
        const release = state.project.releases.find((r) => r.id === message.releaseId);
        if (release) {
          bridge.emit({ type: "export-result", format: message.format, content: release.changelogMarkdown, releaseId: release.id });
        }
        return;
      }
      default:
        return;
    }
  };

  return state;
}
