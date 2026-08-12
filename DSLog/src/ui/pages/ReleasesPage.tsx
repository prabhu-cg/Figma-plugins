import React, { useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { Banner, OptionCard } from "@ui/components/Shared";
import { Tabs } from "@ui/components/Tabs";
import {
  AlertIcon,
  CheckCircleIcon,
  ChecklistIcon,
  CloseIcon,
  ComponentGlyphIcon,
  CopyIcon,
  TokenGlyphIcon,
  TrackIcon,
} from "@ui/components/Icons";
import type { PageId } from "@ui/App";
import { getLatestChangeSetForBaseline } from "@shared/utils/changeSets";
import { recommendVersion, type VersionRecommendation } from "@shared/utils/versionRecommendation";
import { hasBlockingIssues, validateRelease, type ValidationCheck } from "@shared/utils/releaseValidation";
import { buildMigrationReport, type MigrationItem } from "@shared/utils/migrationReport";

type Tab = "create" | "past";

export function ReleasesPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { project, send, scanning, exportContent, clearExportContent, lastRelease, clearLastRelease } =
    useProjectState();
  const [tab, setTab] = useState<Tab>("create");
  const [version, setVersion] = useState("1.1.0");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeComponents, setIncludeComponents] = useState(false);
  const [includeTokens, setIncludeTokens] = useState(false);
  const [includeBreaking, setIncludeBreaking] = useState(false);
  const [includeMigration, setIncludeMigration] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | undefined>(undefined);

  if (!project) return null;

  if (!project.currentBaselineId) {
    return (
      <div className="state-screen">
        <div className="state-icon">
          <TrackIcon style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">No baseline yet</div>
        <div className="state-body">Create a baseline before creating a release.</div>
        <button className="btn btn-primary" onClick={() => onNavigate("track")}>
          Create baseline
        </button>
      </div>
    );
  }

  const baseline = project.baselines.find((b) => b.id === project.currentBaselineId);
  const changeSet = baseline ? getLatestChangeSetForBaseline(project, baseline.id) : undefined;
  const changesSinceRelease = changeSet?.changes ?? [];

  const existingVersions = project.releases.map((r) => r.version);
  const recommendation = baseline
    ? recommendVersion(baseline.version, changesSinceRelease, existingVersions)
    : undefined;
  const validationChecks = validateRelease({
    version,
    existingVersions,
    changes: changesSinceRelease,
    trackedEntities: project.trackedEntities,
  });
  const migrationItems = buildMigrationReport(changesSinceRelease, project.trackedEntities);

  const canCreate = version.trim().length > 0 && title.trim().length > 0 && !hasBlockingIssues(validationChecks);
  const includedCount = [includeComponents, includeTokens, includeBreaking, includeMigration].filter(Boolean).length;

  const createRelease = () => {
    send({
      type: "create-release",
      version: version.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      include: {
        components: includeComponents,
        tokens: includeTokens,
        breakingChanges: includeBreaking,
        migrationNotes: includeMigration,
      },
    });
  };

  const copyToClipboard = async () => {
    if (!exportContent) return;
    try {
      await navigator.clipboard.writeText(exportContent.content);
      setCopyStatus("Copied to clipboard");
    } catch {
      setCopyStatus("Could not copy — select and copy manually");
    }
    setTimeout(() => setCopyStatus(undefined), 3000);
  };

  const toggleChangelog = (releaseId: string) => {
    if (exportContent?.releaseId === releaseId) {
      clearExportContent();
    } else {
      send({ type: "export", format: "markdown", releaseId });
    }
  };

  const changelogPanel = (
    <div className="card" style={{ marginTop: 8, background: "var(--color-surface-alt)" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className="card-title">Markdown changelog</span>
        <button className="btn btn-ghost btn-sm" onClick={clearExportContent} aria-label="Close">
          <CloseIcon style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <textarea
        className="textarea"
        readOnly
        value={exportContent?.content ?? ""}
        rows={10}
        style={{ fontFamily: "monospace", fontSize: 11 }}
      />
      <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={copyToClipboard}>
          <CopyIcon style={{ width: 14, height: 14 }} />
          Copy to clipboard
        </button>
        {copyStatus && <span className="text-tertiary" style={{ fontSize: 11.5 }}>{copyStatus}</span>}
      </div>
    </div>
  );

  const showFooter = tab === "create" && !lastRelease;

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ flex: "1 1 auto" }}>
        <div className="view-header">
          <div>
            <div className="view-title">Releases</div>
            <div className="view-subtitle">Bundle reviewed changes into a named version with a changelog</div>
          </div>
        </div>

        <Banner kind="info" style={{ marginBottom: "var(--space-3)" }}>
          A release packages everything changed since your current baseline into a versioned changelog, then
          becomes the new baseline — so your next scan compares against this point going forward.
        </Banner>

        {tab === "create" && !lastRelease && changesSinceRelease.length > 0 && (
          <Banner kind="info" style={{ marginBottom: "var(--space-3)" }}>
            {changesSinceRelease.length} change{changesSinceRelease.length === 1 ? "" : "s"} since your last release.
          </Banner>
        )}

        <Tabs
          tabs={[
            { id: "create", label: "Create release" },
            { id: "past", label: `Past releases${project.releases.length > 0 ? ` (${project.releases.length})` : ""}` },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "create" &&
          (lastRelease ? (
            <div className="card">
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <div className="state-icon" style={{ width: 32, height: 32, background: "var(--color-success-soft)", color: "var(--color-success)" }}>
                  <CheckCircleIcon style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Release created</div>
                  <div className="text-secondary" style={{ fontSize: 12 }}>Version {lastRelease.version}</div>
                </div>
              </div>
              <div className="flex gap-2 wrap">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    send({ type: "export", format: "markdown", releaseId: lastRelease.id });
                    clearLastRelease();
                    setTab("past");
                  }}
                >
                  View changelog
                </button>
                <button className="btn btn-primary btn-sm" onClick={clearLastRelease}>
                  Create another
                </button>
              </div>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "1fr 360px" }}>
              <div className="card-title">Include</div>
              <div className="card-title">Release details</div>

              <div className="flex flex-col gap-2">
                <OptionCard
                  icon={<ComponentGlyphIcon />}
                  title="Components"
                  description="Added, changed, and removed components in this release"
                  selected={includeComponents}
                  onSelect={() => setIncludeComponents((v) => !v)}
                />
                <OptionCard
                  icon={<TokenGlyphIcon />}
                  title="Tokens"
                  description="Design token (variable) changes across every tracked collection"
                  selected={includeTokens}
                  onSelect={() => setIncludeTokens((v) => !v)}
                />
                <OptionCard
                  icon={<AlertIcon />}
                  title="Breaking changes"
                  description="Call out changes that are confirmed or likely to break consumers"
                  selected={includeBreaking}
                  onSelect={() => setIncludeBreaking((v) => !v)}
                />
                <OptionCard
                  icon={<ChecklistIcon />}
                  title="Migration notes"
                  description="Guidance for updating usages that hit a breaking change"
                  selected={includeMigration}
                  onSelect={() => setIncludeMigration((v) => !v)}
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="card">
                  <div className="flex flex-col gap-3">
                    <label className="field">
                      <span className="field-label">Version</span>
                      <input className="input" value={version} onChange={(e) => setVersion(e.target.value)} />
                    </label>
                    <label className="field">
                      <span className="field-label">Release title</span>
                      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Button updates" />
                    </label>
                    <label className="field">
                      <span className="field-label">Description</span>
                      <textarea className="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </label>
                  </div>
                </div>

                {recommendation && (
                  <VersionRecommendationCard recommendation={recommendation} onApply={setVersion} />
                )}

                <ValidationChecklistCard checks={validationChecks} />

                {migrationItems.length > 0 && <MigrationActionsCard items={migrationItems} />}
              </div>
            </div>
          ))}

        {tab === "past" &&
          (project.releases.length === 0 ? (
            <div className="card state-card">
              <div className="text-secondary">No releases yet. Create your first one from the Create release tab.</div>
            </div>
          ) : (
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Title</th>
                    <th style={{ textAlign: "right" }}>Date</th>
                    <th style={{ textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {[...project.releases].reverse().map((release) => {
                    const isOpen = exportContent?.releaseId === release.id;
                    return (
                      <React.Fragment key={release.id}>
                        <tr>
                          <td style={{ fontWeight: 700 }}>v{release.version}</td>
                          <td>{release.title}</td>
                          <td className="text-tertiary" style={{ textAlign: "right" }}>
                            {new Date(release.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleChangelog(release.id)}>
                              {isOpen ? "Hide changelog" : "View changelog"}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={4} style={{ paddingTop: 0 }}>
                              {changelogPanel}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </div>

      {showFooter && (
        <div className="card" style={{ marginTop: "var(--space-3)" }}>
          <div className="flex items-center justify-between">
            <span className="text-secondary" style={{ fontSize: 12.5 }}>
              {includedCount} of 4 sections included
            </span>
            <button className="btn btn-primary" disabled={!canCreate || scanning} onClick={createRelease}>
              {scanning ? "Working…" : "Create release"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const BUMP_LABEL: Record<VersionRecommendation["bump"] & string, string> = {
  major: "MAJOR",
  minor: "MINOR",
  patch: "PATCH",
};

function VersionRecommendationCard({
  recommendation,
  onApply,
}: {
  recommendation: VersionRecommendation;
  onApply: (version: string) => void;
}) {
  if (!recommendation.bump) {
    return (
      <div className="card">
        <div className="card-title" style={{ marginBottom: 4 }}>
          Recommended version
        </div>
        <div className="text-secondary" style={{ fontSize: 12 }}>
          {recommendation.reason}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <div className="card-title">Recommended version</div>
        <span className="badge badge-neutral">{BUMP_LABEL[recommendation.bump]}</span>
      </div>
      {recommendation.recommendedVersion ? (
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{recommendation.recommendedVersion}</div>
      ) : null}
      <div className="text-secondary" style={{ fontSize: 12, marginBottom: recommendation.recommendedVersion ? 10 : 0 }}>
        {recommendation.reason}
      </div>
      {recommendation.recommendedVersion && (
        <button className="btn btn-secondary btn-sm" onClick={() => onApply(recommendation.recommendedVersion as string)}>
          Use recommended
        </button>
      )}
    </div>
  );
}

function ValidationChecklistCard({ checks }: { checks: ValidationCheck[] }) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 8 }}>
        Release validation
      </div>
      <div className="flex flex-col gap-2">
        {checks.map((check) => (
          <div key={check.id} className="flex items-start gap-2" style={{ fontSize: 12 }}>
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                color:
                  check.status === "pass"
                    ? "var(--color-success)"
                    : check.status === "warning"
                      ? "var(--color-warning-text)"
                      : "var(--color-critical)",
              }}
            >
              {check.status === "pass" ? "✓" : check.status === "warning" ? "⚠" : "✗"}
            </span>
            <span>
              <span className={check.status === "pass" ? "text-secondary" : undefined}>{check.label}</span>
              {check.detail && (
                <span className="text-tertiary" style={{ display: "block", fontSize: 11 }}>
                  {check.detail}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MigrationActionsCard({ items }: { items: MigrationItem[] }) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 8 }}>
        Migration actions ({items.length})
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.entityId} style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600 }}>{item.entityName}</div>
            <div className="text-secondary">{item.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
