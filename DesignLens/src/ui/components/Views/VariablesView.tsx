import { useMemo, useState } from "react";
import type { ScanResult } from "@shared/types";
import { SearchIcon } from "../Icons";

const COLLECTION_PAGE_SIZE = 200;

interface VariablesViewProps {
  result: ScanResult;
}

export function VariablesView({ result }: VariablesViewProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { unusedNames, duplicateNames } = useMemo(() => {
    const unused = new Set<string>();
    const duplicate = new Set<string>();
    for (const issue of result.issues) {
      if (issue.ruleId === "tokens-unused-variable" && issue.meta?.variableName) {
        unused.add(String(issue.meta.variableName));
      }
      if (issue.ruleId === "tokens-duplicate-variable") {
        if (issue.meta?.a) duplicate.add(String(issue.meta.a));
        if (issue.meta?.b) duplicate.add(String(issue.meta.b));
      }
    }
    return { unusedNames: unused, duplicateNames: duplicate };
  }, [result.issues]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? result.variables.filter((v) => v.name.toLowerCase().includes(q)) : result.variables;
    const byCollection = new Map<string, typeof filtered>();
    for (const v of filtered) {
      const list = byCollection.get(v.collectionName) ?? [];
      list.push(v);
      byCollection.set(v.collectionName, list);
    }
    return Array.from(byCollection.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [result.variables, search]);

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Variables</div>
          <div className="view-subtitle">
            {result.variables.length} variables across {result.tokenStats.totalCollections} collections
          </div>
        </div>
      </div>

      <div style={{ position: "relative", maxWidth: 320, marginBottom: 16 }}>
        <SearchIcon style={{ position: "absolute", left: 10, top: 9, width: 14, height: 14, color: "var(--color-text-tertiary)" }} />
        <input
          className="input"
          style={{ paddingLeft: 30, width: "100%" }}
          placeholder="Search variables…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-4" style={{ marginBottom: 16 }}>
        <MiniStat label="Variables" value={result.tokenStats.totalVariables} />
        <MiniStat label="Styles" value={result.tokenStats.totalStyles} />
        <MiniStat label="Unused" value={result.tokenStats.unusedVariableCount} />
        <MiniStat label="Duplicate" value={result.tokenStats.duplicateVariableCount} />
      </div>

      {grouped.map(([collectionName, vars]) => {
        const isExpanded = expanded.has(collectionName);
        const visible = isExpanded ? vars : vars.slice(0, COLLECTION_PAGE_SIZE);
        const remaining = vars.length - visible.length;
        return (
          <div key={collectionName} className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", fontWeight: 700 }}>
              {collectionName}
              <span className="text-tertiary" style={{ fontWeight: 500, marginLeft: 8 }}>
                {vars.length} variables
              </span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Alias</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.name}</td>
                    <td className="text-secondary">{v.resolvedType}</td>
                    <td className="text-secondary">{v.isAlias ? "Yes" : "No"}</td>
                    <td>
                      {duplicateNames.has(v.name) && <span className="badge badge-warning">Duplicate</span>}
                      {unusedNames.has(v.name) && <span className="badge badge-neutral" style={{ marginLeft: 6 }}>Unused</span>}
                      {!duplicateNames.has(v.name) && !unusedNames.has(v.name) && (
                        <span className="badge badge-success">In use</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {remaining > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", margin: "8px 0" }}
                onClick={() => setExpanded((prev) => new Set(prev).add(collectionName))}
              >
                Load {remaining} more in {collectionName}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
