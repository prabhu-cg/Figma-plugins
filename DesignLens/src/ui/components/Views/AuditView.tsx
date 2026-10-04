import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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

const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"]);

/** True where a keystroke is text entry or a native control's own key handling, so shortcuts must stay out of the way. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === "INPUT") return !NON_TEXT_INPUTS.has((target as HTMLInputElement).type);
  return target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export function AuditView({ result, audit, onSelectNode, onSetIssueStatuses }: AuditViewProps) {
  const { filters, setFilters, sort, setSort, selectedId, setSelectedId, checked, setChecked, hintVisible, setHintVisible } = audit;
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const allToggle = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Set when a keyboard action changes the selection, so focus follows it and shortcuts keep working.
  const focusSelection = useRef(false);

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

  // Deferred so typing in search stays responsive while a very large list re-filters.
  const deferredFilters = useDeferredValue(filters);
  const sortedIssues = useMemo(
    () => sortIssues(filterIssues(result.issues, deferredFilters), sort),
    [result.issues, deferredFilters, sort]
  );
  const facets = useMemo(() => countFacets(result.issues, deferredFilters), [result.issues, deferredFilters]);
  const { visible, hasMore, remaining, loadMore } = useLoadMore(sortedIssues, PAGE_SIZE);
  const selectedIssue = sortedIssues.find((i) => i.id === selectedId) ?? null;
  const checkedIssues = useMemo(() => sortedIssues.filter((i) => checked.has(i.id)), [sortedIssues, checked]);

  // Applies a status change and offers to undo it, restoring each issue's own previous status.
  const applyStatus = useCallback(
    (targets: Issue[], status: IssueStatus, opts?: { keyboard?: boolean }) => {
      const changing = targets.filter((i) => i.status !== status);
      if (changing.length === 0) return;
      if (opts?.keyboard) focusSelection.current = true;
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

  // Keep the selected row on screen and, after a keyboard action, keep focus on it (or on the list if
  // nothing is left) so the next keystroke still lands inside the shortcut scope.
  useEffect(() => {
    const row = selectedId ? document.querySelector(`[data-issue-id="${CSS.escape(selectedId)}"]`) : null;
    row?.scrollIntoView({ block: "nearest" });
    if (focusSelection.current) {
      focusSelection.current = false;
      (row?.querySelector(".issue-card") as HTMLElement | null ?? scrollRef.current)?.focus();
    }
  }, [selectedId, visible]);

  // Select-all checkbox shows a mixed state when only some rows are checked.
  useEffect(() => {
    if (allToggle.current) allToggle.current.indeterminate = checkedIssues.length > 0 && checkedIssues.length < sortedIssues.length;
  }, [checkedIssues.length, sortedIssues.length]);

  // Single-letter shortcuts are scoped to focus inside the list/detail area (WCAG 2.1.4): they never
  // fire from elsewhere on the page, so dictation or assistive tech can't trigger them by accident.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
    const targets = checkedIssues.length > 0 ? checkedIssues : selectedIssue ? [selectedIssue] : [];

    switch (event.key) {
      case "j":
      case "k":
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const forward = event.key === "j" || event.key === "ArrowDown";
        const ids = visible.map((i) => i.id);
        if (forward && hasMore && selectedId === ids[ids.length - 1]) loadMore();
        const next = stepSelection(ids, selectedId, forward ? 1 : -1);
        if (next !== selectedId) focusSelection.current = true;
        setSelectedId(next);
        break;
      }
      case "x":
        if (selectedId) toggleChecked(selectedId);
        break;
      case "r":
        applyStatus(targets, "resolved", { keyboard: true });
        break;
      case "i":
        applyStatus(targets, "ignored", { keyboard: true });
        break;
      case "o":
        applyStatus(targets, "open", { keyboard: true });
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

  const allChecked = sortedIssues.length > 0 && checkedIssues.length === sortedIssues.length;

  return (
    <div className="view audit-view">
      <div className="audit-head">
        <div className="view-header" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="view-title">Audit</h1>
            <div className="view-subtitle">
              {sortedIssues.length} of {result.issues.length} issues shown
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            aria-expanded={hintVisible}
            aria-controls="shortcut-hint"
            onClick={() => setHintVisible(!hintVisible)}
          >
            {hintVisible ? "Hide shortcuts" : "Shortcuts"}
          </button>
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
        <div id="shortcut-hint" className={`shortcut-hint-wrap${hintVisible ? "" : " is-collapsed"}`}>
          <div className="shortcut-hint-clip">
            <div className="shortcut-hint">
              With the list focused: <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>x</kbd> select · <kbd>r</kbd> resolve · <kbd>i</kbd> ignore ·{" "}
              <kbd>o</kbd> reopen · <kbd>g</kbd> go to layer
            </div>
          </div>
        </div>
      </div>

      <div className="audit-scroll" ref={scrollRef} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="audit-grid">
          <div className="audit-list-col">
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

      {/* The live region stays mounted and empty so screen readers reliably announce what's added to it. */}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <span>{toast.message}</span>
            <button className="btn btn-ghost btn-sm toast-undo" onClick={toast.undo}>
              Undo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
