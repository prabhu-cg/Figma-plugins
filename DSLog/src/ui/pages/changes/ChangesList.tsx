import { ChangeListItem } from "@ui/components/ChangeListItem";
import type { ChangesView } from "./useChangesView";

export function ChangesList({ view, unreviewedCount }: { view: ChangesView; unreviewedCount: number }) {
  const { filtered, checkedIds } = view;
  const allChecked = filtered.length > 0 && filtered.every((c) => checkedIds.has(c.id));
  const someChecked = filtered.some((c) => checkedIds.has(c.id));

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
      {filtered.map((change) => (
        <ChangeListItem
          key={change.id}
          change={change}
          selected={view.selectedId === change.id}
          onSelect={() => view.setSelectedId(change.id)}
          checked={checkedIds.has(change.id)}
          onToggleCheck={() => view.toggleChecked(change.id)}
        />
      ))}
      <div className="text-tertiary" style={{ fontSize: 11.5, paddingTop: 4 }}>
        <span className="kbd">↑</span> <span className="kbd">↓</span> move · <span className="kbd">A</span> accept ·{" "}
        <span className="kbd">R</span> reject · <span className="kbd">V</span> reviewed · <span className="kbd">Z</span> undo
      </div>
    </div>
  );
}
