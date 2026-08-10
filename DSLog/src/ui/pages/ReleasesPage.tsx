import React, { useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { CheckCircleIcon, CloseIcon, CopyIcon, TrackIcon } from "@ui/components/Icons";
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
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Releases</div>
          <div className="view-subtitle">Bundle reviewed changes into a named version with a changelog</div>
        </div>
      </div>

      {exportContent && (
        <div className="card" style={{ marginBottom: "var(--space-3)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className="card-title">{exportContent.format === "markdown" ? "Markdown" : "JSON"} export</span>
            <button className="btn btn-ghost btn-sm" onClick={clearExportContent}>
              <CloseIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <textarea className="textarea" readOnly value={exportContent.content} rows={10} style={{ fontFamily: "monospace", fontSize: 11 }} />
          <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={copyToClipboard}>
              <CopyIcon style={{ width: 14, height: 14 }} />
              Copy to clipboard
            </button>
            {copyStatus && <span className="text-tertiary" style={{ fontSize: 11.5 }}>{copyStatus}</span>}
          </div>
        </div>
      )}

      {lastRelease ? (
        <div className="card" style={{ marginBottom: "var(--space-3)" }}>
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
            <button className="btn btn-secondary btn-sm" onClick={() => send({ type: "export", format: "markdown", releaseId: lastRelease.id })}>
              Export Markdown
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => send({ type: "export", format: "json", releaseId: lastRelease.id })}>
              Export JSON
            </button>
            <button className="btn btn-primary btn-sm" onClick={clearLastRelease}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: "var(--space-3)" }}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            Create release
          </div>
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

            <div>
              <div className="field-label" style={{ marginBottom: 4 }}>
                Include
              </div>
              <label className="checkbox-row">
                <input type="checkbox" checked={includeComponents} onChange={(e) => setIncludeComponents(e.target.checked)} />
                <span style={{ fontSize: 12.5 }}>Components</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={includeTokens} onChange={(e) => setIncludeTokens(e.target.checked)} />
                <span style={{ fontSize: 12.5 }}>Tokens</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={includeBreaking} onChange={(e) => setIncludeBreaking(e.target.checked)} />
                <span style={{ fontSize: 12.5 }}>Breaking changes</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={includeMigration} onChange={(e) => setIncludeMigration(e.target.checked)} />
                <span style={{ fontSize: 12.5 }}>Migration notes</span>
              </label>
            </div>

            <div>
              <button className="btn btn-primary" disabled={!canCreate || scanning} onClick={createRelease}>
                {scanning ? "Working…" : "Create release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {project.releases.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Past releases
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Title</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...project.releases].reverse().map((release) => (
                <tr key={release.id}>
                  <td style={{ fontWeight: 700 }}>v{release.version}</td>
                  <td>{release.title}</td>
                  <td className="text-tertiary">{new Date(release.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => send({ type: "export", format: "markdown", releaseId: release.id })}
                      >
                        Markdown
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => send({ type: "export", format: "json", releaseId: release.id })}
                      >
                        JSON
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
