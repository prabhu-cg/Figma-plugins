import React, { useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { Button } from "@ui/components/Button";
import { EmptyState } from "@ui/components/EmptyState";
import type { PageId } from "@ui/App";

export function ReleasesPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { project, send, scanning, exportContent, clearExportContent, lastRelease, clearLastRelease } =
    useProjectState();
  const [version, setVersion] = useState("1.1.0");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeComponents, setIncludeComponents] = useState(true);
  const [includeTokens, setIncludeTokens] = useState(true);
  const [includeBreaking, setIncludeBreaking] = useState(true);
  const [includeMigration, setIncludeMigration] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | undefined>(undefined);

  if (!project) return null;

  if (!project.currentBaselineId) {
    return (
      <div className="dslog-page">
        <EmptyState
          title="No baseline yet"
          description="Create a baseline before creating a release."
          action={
            <Button variant="primary" onClick={() => onNavigate("track")}>
              Create baseline
            </Button>
          }
        />
      </div>
    );
  }

  const canCreate = version.trim().length > 0 && title.trim().length > 0;

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

  return (
    <div className="dslog-page">
      {exportContent && (
        <div className="dslog-export-panel">
          <div className="dslog-row-between">
            <span className="dslog-label">
              {exportContent.format === "markdown" ? "Markdown" : "JSON"} export
            </span>
            <button className="dslog-link" onClick={clearExportContent}>
              Close
            </button>
          </div>
          <textarea className="dslog-export-textarea" readOnly value={exportContent.content} rows={10} />
          <div className="dslog-actions">
            <Button onClick={copyToClipboard}>Copy to clipboard</Button>
            {copyStatus && <span className="dslog-hint">{copyStatus}</span>}
          </div>
        </div>
      )}

      {lastRelease ? (
        <div className="dslog-card dslog-card--success">
          <h3>Release created</h3>
          <div className="dslog-label">Version {lastRelease.version}</div>
          <div className="dslog-actions">
            <Button onClick={() => send({ type: "export", format: "markdown", releaseId: lastRelease.id })}>
              Export Markdown
            </Button>
            <Button onClick={() => send({ type: "export", format: "json", releaseId: lastRelease.id })}>
              Export JSON
            </Button>
            <Button variant="primary" onClick={clearLastRelease}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="dslog-section dslog-section--form">
          <div className="dslog-label">Create release</div>
          <label className="dslog-field">
            <span>Version</span>
            <input value={version} onChange={(e) => setVersion(e.target.value)} />
          </label>
          <label className="dslog-field">
            <span>Release title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Button updates" />
          </label>
          <label className="dslog-field">
            <span>Description</span>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className="dslog-label">Include</div>
          <label className="dslog-checkbox">
            <input type="checkbox" checked={includeComponents} onChange={(e) => setIncludeComponents(e.target.checked)} />
            <span>Components</span>
          </label>
          <label className="dslog-checkbox">
            <input type="checkbox" checked={includeTokens} onChange={(e) => setIncludeTokens(e.target.checked)} />
            <span>Tokens</span>
          </label>
          <label className="dslog-checkbox">
            <input type="checkbox" checked={includeBreaking} onChange={(e) => setIncludeBreaking(e.target.checked)} />
            <span>Breaking changes</span>
          </label>
          <label className="dslog-checkbox">
            <input type="checkbox" checked={includeMigration} onChange={(e) => setIncludeMigration(e.target.checked)} />
            <span>Migration notes</span>
          </label>

          <Button variant="primary" disabled={!canCreate || scanning} onClick={createRelease}>
            {scanning ? "Working…" : "Create release"}
          </Button>
        </div>
      )}

      {project.releases.length > 0 && (
        <div className="dslog-section">
          <div className="dslog-label">Past releases</div>
          <div className="dslog-release-list">
            {[...project.releases].reverse().map((release) => (
              <div key={release.id} className="dslog-release-row">
                <div>
                  <div className="dslog-release-row__title">
                    v{release.version} — {release.title}
                  </div>
                  <div className="dslog-hint">{new Date(release.createdAt).toLocaleString()}</div>
                </div>
                <div className="dslog-actions">
                  <button
                    className="dslog-link"
                    onClick={() => send({ type: "export", format: "markdown", releaseId: release.id })}
                  >
                    Markdown
                  </button>
                  <button
                    className="dslog-link"
                    onClick={() => send({ type: "export", format: "json", releaseId: release.id })}
                  >
                    JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
