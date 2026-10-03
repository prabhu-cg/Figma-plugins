import { useEffect, useMemo, useRef, type RefObject } from "react";
import { ChangeListItem } from "@ui/components/ChangeListItem";
import type { ChangesView } from "./useChangesView";

export function ChangesList({
  view,
  unreviewedCount,
  scrollRoot,
}: {
  view: ChangesView;
  unreviewedCount: number;
  /** The element that scrolls the list; the next page of rows loads shortly before its end comes into view. */
  scrollRoot: RefObject<HTMLElement | null>;
}) {
  const { filtered, checkedIds, shownCount, hasMore, showMore } = view;
  const { allChecked, someChecked } = useMemo(() => {
    const checkedVisible = filtered.reduce((n, c) => (checkedIds.has(c.id) ? n + 1 : n), 0);
    return { allChecked: filtered.length > 0 && checkedVisible === filtered.length, someChecked: checkedVisible > 0 };
  }, [filtered, checkedIds]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinel.current;
    if (!hasMore || !target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && showMore(), {
      root: scrollRoot.current,
      rootMargin: "800px 0px",
    });
    observer.observe(target);
    return () => observer.disconnect();
    // Re-observe after every page: if the sentinel is still near the viewport, the next page should load too.
  }, [hasMore, shownCount, showMore, scrollRoot]);

  return (
    <div className="flex flex-col gap-2" style={{ paddingRight: 4 }}>
      <div className="flex items-center justify-between gap-2 wrap" style={{ paddingBottom: 4 }}>
        <label className="checkbox-row text-secondary" style={{ fontSize: 12, fontWeight: 600, padding: 0 }}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = someChecked && !allChecked;
            }}
            onChange={view.toggleAllChecked}
          />
          Select all {filtered.length}
        </label>
        <button className="btn btn-ghost btn-sm" disabled={unreviewedCount === 0} onClick={view.jumpToNextUnreviewed}>
          Next unreviewed{" "}
          <span className="kbd" aria-hidden>
            N
          </span>
        </button>
      </div>
      {filtered.slice(0, shownCount).map((change) => (
        <ChangeListItem
          key={change.id}
          change={change}
          selected={view.selectedId === change.id}
          onSelect={view.setSelectedId}
          checked={checkedIds.has(change.id)}
          onToggleCheck={view.toggleChecked}
        />
      ))}
      {hasMore && (
        <div ref={sentinel} className="text-tertiary" style={{ fontSize: 11.5, padding: "8px 0", textAlign: "center" }}>
          Showing {shownCount} of {filtered.length} — scroll for more
        </div>
      )}
      <div className="text-tertiary" style={{ fontSize: 11.5, paddingTop: 4 }}>
        <span className="kbd">↑</span> <span className="kbd">↓</span> move · <span className="kbd">A</span> accept ·{" "}
        <span className="kbd">R</span> reject · <span className="kbd">V</span> reviewed · <span className="kbd">Z</span> undo
      </div>
    </div>
  );
}
