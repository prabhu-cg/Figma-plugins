import { useMemo } from 'react';
import { useAppStore } from '@ui/store/appStore';
import { GROUP_LABELS, GROUP_ORDER } from '@ui/utils/labels';
import { filterQuestions } from '@ui/utils/questionFilters';
import { AddQuestionForm } from './AddQuestionForm';
import { QuestionCard } from './QuestionCard';

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <p className="text-xs font-semibold text-gray-900">
      {title} <span className="font-normal text-gray-400">({count})</span>
    </p>
  );
}

export function QuestionsList() {
  const questions = useAppStore((s) => s.questions);
  const customQuestions = useAppStore((s) => s.customQuestions);
  const responses = useAppStore((s) => s.responses);
  const analysis = useAppStore((s) => s.analysis);
  const search = useAppStore((s) => s.questionSearch);
  const statusFilter = useAppStore((s) => s.questionStatusFilter);
  const groupFilter = useAppStore((s) => s.questionGroupFilter);

  const allQuestions = useMemo(() => [...questions, ...customQuestions], [questions, customQuestions]);
  const filtered = filterQuestions(allQuestions, responses, { search, status: statusFilter, group: groupFilter });
  const showFrameName = Boolean(analysis?.multiFrame);
  const defaultGroup = groupFilter === 'all' ? 'functional' : groupFilter;

  return (
    <div className="flex flex-1 min-w-[450px] flex-col gap-5 overflow-y-auto p-4">
      <AddQuestionForm defaultGroup={defaultGroup} />

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xxs text-gray-400">No questions match the current filters.</p>
      ) : groupFilter === 'all' ? (
        GROUP_ORDER.map((group) => {
          const items = filtered.filter((q) => q.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-2">
              <SectionHeading title={GROUP_LABELS[group]} count={items.length} />
              <div className="flex flex-col gap-2">
                {items.map((question) => (
                  <QuestionCard key={question.id} question={question} showFrameName={showFrameName} />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="flex flex-col gap-2">
          <SectionHeading title={GROUP_LABELS[groupFilter]} count={filtered.length} />
          {filtered.map((question) => (
            <QuestionCard key={question.id} question={question} showFrameName={showFrameName} />
          ))}
        </div>
      )}
    </div>
  );
}
