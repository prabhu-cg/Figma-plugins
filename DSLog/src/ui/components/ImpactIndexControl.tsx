import React from "react";
import { useProjectState } from "@ui/state/ProjectContext";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Explicit, opt-in trigger for the document-wide instance scan (spec §19 —
 * never run implicitly). Shows when the index was last built and lets the
 * user (re)build it, with progress feedback since it walks every page.
 */
export function ImpactIndexControl() {
  const { project, send, instanceIndexBuilding, instanceIndexProgress } = useProjectState();
  const index = project?.instanceIndex;

  return (
    <div className="card flex items-center justify-between wrap gap-2">
      <div>
        <div style={{ fontWeight: 700, fontSize: 12.5 }}>Impact index</div>
        <div className="text-secondary" style={{ fontSize: 11.5, marginTop: 2 }}>
          {instanceIndexBuilding
            ? `Scanning… ${instanceIndexProgress?.pagesDone ?? 0}/${instanceIndexProgress?.pagesTotal ?? 0} pages, ${instanceIndexProgress?.instancesFound ?? 0} instances found`
            : index
              ? `Last built ${formatDate(index.builtAt)} · ${index.totalInstancesScanned} instances scanned`
              : "Not built yet — instance counts and \"potentially affected\" lists need a document-wide scan."}
        </div>
      </div>
      <button
        className="btn btn-secondary btn-sm"
        disabled={instanceIndexBuilding}
        onClick={() => send({ type: "build-impact-index" })}
      >
        {index ? "Rebuild impact index" : "Build impact index"}
      </button>
    </div>
  );
}
