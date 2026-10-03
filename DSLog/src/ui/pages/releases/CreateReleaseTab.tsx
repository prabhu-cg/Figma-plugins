import { useProjectState } from "@ui/state/ProjectContext";
import { OptionCard } from "@ui/components/Shared";
import {
  AlertIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ComponentGlyphIcon,
  CopyIcon,
  TokenGlyphIcon,
} from "@ui/components/Icons";
import { MigrationActionsCard, ValidationChecklistCard, VersionRecommendationCard } from "./ReleaseCards";
import { useCopyStatus } from "./useCopyStatus";
import type { ReleaseDraft } from "./useReleaseDraft";

export function CreateReleaseTab({ draft, onViewChangelog }: { draft: ReleaseDraft; onViewChangelog: () => void }) {
  const { send, lastRelease, clearLastRelease } = useProjectState();
  const [copyStatus, copyText] = useCopyStatus();

  if (lastRelease) {
    return (
      <div className="card">
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <div
            className="state-icon"
            style={{ width: 32, height: 32, background: "var(--color-success-soft)", color: "var(--color-success-text)" }}
          >
            <CheckCircleIcon style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Release created</div>
            <div className="text-secondary" style={{ fontSize: 12 }}>Version {lastRelease.version}</div>
          </div>
        </div>
        <div className="flex gap-2 wrap">
          <button className="btn btn-primary btn-sm" onClick={() => copyText(lastRelease.changelogMarkdown)}>
            <CopyIcon style={{ width: 14, height: 14 }} />
            Copy changelog
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              send({ type: "export", format: "markdown", releaseId: lastRelease.id });
              clearLastRelease();
              onViewChangelog();
            }}
          >
            View changelog
          </button>
          <button className="btn btn-ghost btn-sm" onClick={clearLastRelease}>
            Create another
          </button>
        </div>
        {copyStatus && (
          <div className="text-secondary" role="status" style={{ fontSize: 11.5, marginTop: 8 }}>
            {copyStatus}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="split">
      <div className="flex flex-col gap-3">
        <div className="card-title">Include</div>

        <div className="flex flex-col gap-2">
          <OptionCard
            icon={<ComponentGlyphIcon />}
            title="Components"
            description="Added, changed, and removed components in this release"
            selected={draft.includeComponents}
            onSelect={() => draft.setIncludeComponents((v) => !v)}
          />
          <OptionCard
            icon={<TokenGlyphIcon />}
            title="Tokens"
            description="Design token (variable) changes across every tracked collection"
            selected={draft.includeTokens}
            onSelect={() => draft.setIncludeTokens((v) => !v)}
          />
          <OptionCard
            icon={<AlertIcon />}
            title="Breaking changes"
            description="Call out changes that are confirmed or likely to break consumers"
            selected={draft.includeBreaking}
            onSelect={() => draft.setIncludeBreaking((v) => !v)}
          />
          <OptionCard
            icon={<ChecklistIcon />}
            title="Migration notes"
            description="Guidance for updating usages that hit a breaking change"
            selected={draft.includeMigration}
            onSelect={() => draft.setIncludeMigration((v) => !v)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card-title">Release details</div>
        <div className="card">
          <div className="flex flex-col gap-3">
            <label className="field">
              <span className="field-label">Version</span>
              <input className="input" value={draft.version} onChange={(e) => draft.editVersion(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Release title</span>
              <input
                className="input"
                value={draft.title}
                onChange={(e) => draft.setTitle(e.target.value)}
                placeholder="Button updates"
              />
            </label>
            <label className="field">
              <span className="field-label">Description</span>
              <textarea
                className="textarea"
                rows={2}
                value={draft.description}
                onChange={(e) => draft.setDescription(e.target.value)}
              />
            </label>
          </div>
        </div>

        {draft.recommendation && (
          <VersionRecommendationCard
            recommendation={draft.recommendation}
            currentVersion={draft.version}
            onApply={draft.editVersion}
          />
        )}

        <ValidationChecklistCard checks={draft.validationChecks} />

        {draft.migrationItems.length > 0 && <MigrationActionsCard items={draft.migrationItems} />}
      </div>
    </div>
  );
}
