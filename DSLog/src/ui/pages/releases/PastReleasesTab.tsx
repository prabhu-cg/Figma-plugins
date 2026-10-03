import React from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { CloseIcon, CopyIcon } from "@ui/components/Icons";
import { formatDate } from "@ui/utils/formatDate";
import { useCopyStatus } from "./useCopyStatus";

export function PastReleasesTab() {
  const { project, send, exportContent, clearExportContent } = useProjectState();
  const [copyStatus, copyText] = useCopyStatus();

  if (!project) return null;

  if (project.releases.length === 0) {
    return (
      <div className="card state-card">
        <div className="text-secondary">No releases yet. Create your first one from the Create release tab.</div>
      </div>
    );
  }

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
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => exportContent && void copyText(exportContent.content)}
        >
          <CopyIcon style={{ width: 14, height: 14 }} />
          Copy to clipboard
        </button>
        {copyStatus && <span className="text-tertiary" style={{ fontSize: 11.5 }}>{copyStatus}</span>}
      </div>
    </div>
  );

  return (
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
                    {formatDate(release.createdAt)}
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
  );
}
