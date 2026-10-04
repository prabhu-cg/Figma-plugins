import { useState } from "react";
import { DEFAULT_FILTERS, type FiltersState, type SortKey } from "../lib/issueView";

/**
 * Audit view state lives above the view so filters, sort, selection and checked rows survive
 * switching to another tab and back (the view unmounts when it isn't active).
 */
export function useAuditState() {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("severity");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  return { filters, setFilters, sort, setSort, selectedId, setSelectedId, checked, setChecked };
}

export type AuditState = ReturnType<typeof useAuditState>;
