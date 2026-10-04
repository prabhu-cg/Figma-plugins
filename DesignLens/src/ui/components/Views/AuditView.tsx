import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Issue, IssueStatus, ScanResult } from "@shared/types";
import { Filters } from "../Filters/Filters";
import { IssueList } from "../IssueList/IssueList";
import { IssueDetail } from "../IssueList/IssueDetail";
import { useLoadMore } from "../../state/useLoadMore";
import type { AuditState } from "../../state/useAuditState";
import { countFacets, DEFAULT_FILTERS, filterIssues, sortIssues, stepSelection } from "../../lib/issueView";

const PAGE_SIZE = 100;
const TOAST_MS = 8000;

interface AuditViewProps {
  result: ScanResult;
  audit: AuditState;
  onSelectNode: (id: string) => void;
  onSetIssueStatuses: (updates: { issue: Issue; status: IssueStatus }[]) => void;
}

interface Toast {
  id: number;
  message: string;
  undo: () => void;
}

const STATUS_VERB: Record<IssueStatus, string> = { open: "reopened", resolved: "marked resolved", ignored: "ignored" };

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function AuditView({ result, audit, onSelectNode, onSetIssueStatuses }: AuditViewProps) {
  const { filters, setFilters, sort, setSort, selectedId, setSelectedId, checked, setChecked } = audit;
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const allToggle = useRef<HTMLInputElement>(null);

  const componentOptions = useMemo(
    () => result.components.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [result.components]
  );

  const collectionOptions = useMemo(
    () =>
      Array.from(new Set(result.issues.map((i) => i.collection).filter((c): c is string => !!c))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [result.issues]
  );

  const sortedIssues = useMemo(() => sortIssues(filterIssues(result.issues, filters), sort), [result.issues, filters, sort]);
  const facets = useMemo(() => countFacets(result.issues, filters), [result.issues, filters]);
  const { visible, hasMore, remaining, loadMore } = useLoadMore(sortedIssues, PAGE_SIZE);
  const selectedIssue = sortedIssues.find((i) => i.id === selectedId) ?? null;
  const checkedIssues = useMemo(() => sortedIssues.filter((i) => checked.has(i.id)), [sortedIssues, checked]);

  // Applies a status change and offers to undo it, restoring each issue's own previous status.
  const applyStatus = useCallback(
    (targets: Issue[], status: IssueStatus) => {
      const changing = targets.filter((i) => i.status !== status);
      if (changing.length === 0) return;
      const previous = changing.map((issue) => ({ issue, status: issue.status }));

      // If the change drops the selected issue out of the filtered list, move to its neighbour.
      if (selectedId && changing.some((i) => i.id === selectedId) && filters.status !== "all" && filters.status !== status) {
        const ids = sortedIssues.map((i) => i.id);
        const at = ids.indexOf(selectedId);
        const gone = new Set(changing.map((i) => i.id));
        setSelectedId(ids.slice(at + 1).find((id) => !gone.has(id)) ?? ids.slice(0, at).reverse().find((id) => !gone.has(id)) ?? null);
      }

      onSetIssueStatuses(changing.map((issue) => ({ issue, status })));
      setChecked(new Set());

      window.clearTimeout(toastTimer.current);
      const id = Date.now();
      const count = changing.length;
      setToast({
        id,
        message: `${count === 1 ? "Issue" : `${count} issues`} ${STATUS_VERB[status]}`,
        undo: () => {
          onSetIssueStatuses(previous);
          setToast(null);
        }
      });
      toastTimer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), TOAST_MS);
    },
    [filters.status, onSetIssueStatuses, selectedId, setChecked, setSelectedId, sortedIssues]
  );

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const toggleChecked = useCallback(
    (id: string) =>
      setChecked((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [setChecked]
  );

  // Keep the keyboard-selected row on screen.
  useEffect(() => {
    if (!selectedId) return;
    document.querySelector(`[data-issue-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Select-all checkbox shows a mixed state when only some rows are checked.
  useEffect(() => {
    if (allToggle.current) allToggle.current.indeterminate = checkedIssues.length > 0 && checkedIssues.length < sortedIssues.length;
  }, [checkedIssues.length, sortedIssues.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const inList = event.target instanceof HTMLElement && !!event.target.closest(".issue-list");
      const targets = checkedIssues.length > 0 ? checkedIssues : selectedIssue ? [selectedIssue] : [];

      switch (event.key) {
        case "j":
        case "k":
        case "ArrowDown":
        case "ArrowUp": {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !inList) return; // leave page scrolling alone
          event.preventDefault();
          const forward = event.key === "j" || event.key === "ArrowDown";
          const ids = visible.map((i) => i.id);
          if (forward && hasMore && selectedId === ids[ids.length - 1]) loadMore();
          setSelectedId(stepSelection(ids, selectedId, forward ? 1 : -1));
          break;
        }
        case "x":
          if (selectedId) toggleChecked(selectedId);
          break;
        case "r":
          applyStatus(targets, "resolved");
          break;
        case "i":
          applyStatus(targets, "ignored");
          break;
        case "o":
          applyStatus(targets, "open");
          break;
        case "g":
          if (selectedIssue?.node) onSelectNode(selectedIssue.node.id);
          break;
        case "Escape":
          if (checked.size > 0) setChecked(new Set());
          else setSelectedId(null);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyStatus, checked.size, checkedIssues, hasMore, loadMore, onSelectNode, selectedId, selectedIssue, setChecked, setSelectedId, toggleChecked, visible]);

  const allChecked = sortedIssues.length > 0 && checkedIssues.length === sortedIssues.length;

  return (
    <div className="view audit-view">
      <div className="audit-head">
        <div className="view-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="view-title">Audit</div>
            <div className="view-subtitle">
              {sortedIssues.length} of {result.issues.length} issues shown
            </div>
          </div>
        </div>

        <Filters
          value={filters}
          onChange={setFilters}
          componentOptions={componentOptions}
          collectionOptions={collectionOptions}
          facets={facets}
          sort={sort}
          onSortChange={setSort}
        />
        <div className="shortcut-hint" aria-hidden="true">
          <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>x</kbd> select · <kbd>r</kbd> resolve · <kbd>i</kbd> ignore · <kbd>o</kbd> reopen ·{" "}
          <kbd>g</kbd> go to layer
        </div>
      </div>

      <div className="audit-scroll">
        <div className="audit-grid">
          <div style={{ minWidth: 0 }}>
            {sortedIssues.length > 0 && (
              <div className="bulk-bar" role="toolbar" aria-label="Bulk actions">
                <label className="bulk-all">
                  <input
                    ref={allToggle}
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setChecked(allChecked ? new Set() : new Set(sortedIssues.map((i) => i.id)))}
                  />
                  {checkedIssues.length > 0 ? `${checkedIssues.length} selected` : `Select all ${sortedIssues.length} shown`}
                </label>
                {checkedIssues.length > 0 && (
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={() => applyStatus(checkedIssues, "resolved")}>
                      Mark resolved
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => applyStatus(checkedIssues, "ignored")}>
                      Ignore
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => applyStatus(checkedIssues, "open")}>
                      Reopen
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setChecked(new Set())}>
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
            <IssueList
              issues={visible}
              totalIssues={result.issues.length}
              selectedId={selectedId}
              checked={checked}
              onSelect={setSelectedId}
              onToggleChecked={toggleChecked}
              onClearFilters={() => setFilters(DEFAULT_FILTERS)}
            />
            {hasMore && (
              <button className="btn btn-secondary btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={loadMore}>
                Load {Math.min(PAGE_SIZE, remaining)} more ({remaining} remaining)
              </button>
            )}
          </div>
          <IssueDetail
            issue={selectedIssue}
            onSelectNode={onSelectNode}
            onSetStatus={(issue, status) => applyStatus([issue], status)}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
          <button className="btn btn-ghost btn-sm toast-undo" onClick={toast.undo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
