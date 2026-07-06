import { useMemo } from 'react';
import type { QuestionGroup } from '@core/types/question.types';
import { useAppStore } from '@ui/store/appStore';
import { GROUP_LABELS, GROUP_ORDER } from '@ui/utils/labels';
import { filterQuestions, type StatusFilter } from '@ui/utils/questionFilters';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'answered', label: 'Answered' },
  { value: 'skipped', label: 'Skipped' },
];

interface GroupButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function GroupButton({ label, count, active, onClick }: GroupButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg border-2 px-2.5 py-2 text-left transition-colors ${
        active ? 'border-brand-600 bg-brand-50' : 'border-canvas-border bg-white hover:border-brand-200'
      }`}
    >
      <span className="flex-1 text-xs font-medium text-gray-800">{label}</span>
      <span className="text-xxs text-gray-400">{count}</span>
    </button>
  );
}

export function QuestionsSidebar() {
  const questions = useAppStore((s) => s.questions);
  const customQuestions = useAppStore((s) => s.customQuestions);
  const responses = useAppStore((s) => s.responses);
  const search = useAppStore((s) => s.questionSearch);
  const statusFilter = useAppStore((s) => s.questionStatusFilter);
  const groupFilter = useAppStore((s) => s.questionGroupFilter);
  const setQuestionSearch = useAppStore((s) => s.setQuestionSearch);
  const setQuestionStatusFilter = useAppStore((s) => s.setQuestionStatusFilter);
  const setQuestionGroupFilter = useAppStore((s) => s.setQuestionGroupFilter);

  const allQuestions = useMemo(() => [...customQuestions, ...questions], [questions, customQuestions]);
  // Counts reflect search/status only, so switching groups never changes another group's count.
  const matching = filterQuestions(allQuestions, responses, { search, status: statusFilter });

  return (
    <aside className="flex w-[200px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-canvas-border bg-canvas-subtle/40 p-3">
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={search}
          onChange={(event) => setQuestionSearch(event.target.value)}
          placeholder="Search questions…"
          className="w-full rounded-lg border border-canvas-border bg-white px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        <select
          value={statusFilter}
          onChange={(event) => setQuestionStatusFilter(event.target.value as StatusFilter)}
          className="w-full rounded-lg border border-canvas-border bg-white px-2 py-1.5 text-xs text-gray-700"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-900">Category</p>
          <p className="text-xxs text-gray-500">Select a group to view its questions</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <GroupButton
            label="All"
            count={matching.length}
            active={groupFilter === 'all'}
            onClick={() => setQuestionGroupFilter('all')}
          />
          {GROUP_ORDER.map((group: QuestionGroup) => (
            <GroupButton
              key={group}
              label={GROUP_LABELS[group]}
              count={matching.filter((q) => q.group === group).length}
              active={groupFilter === group}
              onClick={() => setQuestionGroupFilter(group)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
