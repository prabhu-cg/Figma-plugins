import { useCallback, useState } from "react";
import { DEFAULT_FILTERS, type FiltersState, type SortKey } from "../lib/issueView";

const HINT_KEY = "designlens-shortcut-hint";

function readHintVisible(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) !== "hidden";
  } catch {
    // Storage can be blocked in some plugin embeddings; default to showing the hint.
    return true;
  }
}

/**
 * Audit view state lives above the view so filters, sort, selection and checked rows survive
 * switching to another tab and back (the view unmounts when it isn't active).
 */
export function useAuditState() {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("severity");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [hintVisible, setHintVisibleState] = useState<boolean>(readHintVisible);

  // Remembered across sessions: shown the first time for discoverability, then the user's choice sticks.
  const setHintVisible = useCallback((visible: boolean) => {
    setHintVisibleState(visible);
    try {
      localStorage.setItem(HINT_KEY, visible ? "shown" : "hidden");
    } catch {
      // Non-fatal: the preference just won't persist.
    }
  }, []);

  return { filters, setFilters, sort, setSort, selectedId, setSelectedId, checked, setChecked, hintVisible, setHintVisible };
}

export type AuditState = ReturnType<typeof useAuditState>;
