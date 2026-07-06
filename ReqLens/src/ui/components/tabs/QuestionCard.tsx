import type { GeneratedQuestion, QuestionPriority } from '@core/types/question.types';
import { useAppStore } from '@ui/store/appStore';
import { Badge } from '@ui/components/shared/Badge';
import { CATEGORY_LABELS, PRIORITY_TONE } from '@ui/utils/labels';

const PRIORITY_OPTIONS: QuestionPriority[] = ['high', 'medium', 'low'];

export interface QuestionCardProps {
  question: GeneratedQuestion;
  showFrameName: boolean;
}

function categoryLabel(question: GeneratedQuestion): string {
  if (question.category === 'composite') return 'Cross-component';
  if (question.category === 'custom') return 'Custom';
  return CATEGORY_LABELS[question.category];
}

export function QuestionCard({ question, showFrameName }: QuestionCardProps) {
  const response = useAppStore((s) => s.responses[question.id]);
  const answerQuestion = useAppStore((s) => s.answerQuestion);
  const toggleSkipQuestion = useAppStore((s) => s.toggleSkipQuestion);
  const updateCustomQuestionPriority = useAppStore((s) => s.updateCustomQuestionPriority);
  const removeCustomQuestion = useAppStore((s) => s.removeCustomQuestion);

  const skipped = response?.skipped ?? false;
  const isCustom = question.ruleId === 'custom';

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${skipped ? 'border-canvas-border bg-canvas-subtle/60' : 'border-canvas-border bg-white'}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        <Badge tone="brand">{categoryLabel(question)}</Badge>
        {isCustom ? (
          <select
            value={question.priority}
            onChange={(event) => updateCustomQuestionPriority(question.id, event.target.value as QuestionPriority)}
            className="rounded-full border-0 bg-canvas-subtle px-2 py-0.5 text-xxs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-400"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} priority
              </option>
            ))}
          </select>
        ) : (
          <Badge tone={PRIORITY_TONE[question.priority]}>{question.priority} priority</Badge>
        )}
        {showFrameName && <Badge>{question.frameName}</Badge>}
      </div>
      <p className={`text-xs font-medium text-gray-800 ${skipped ? 'line-through opacity-50' : ''}`}>{question.text}</p>
      <textarea
        value={response?.answer ?? ''}
        onChange={(event) => answerQuestion(question.id, event.target.value)}
        disabled={skipped}
        placeholder="Capture the answer here…"
        rows={2}
        className="mt-2 w-full resize-none rounded-md border border-canvas-border bg-white px-2 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-canvas-subtle"
      />
      <div className="mt-1.5 flex justify-end gap-3">
        {isCustom && (
          <button
            type="button"
            onClick={() => removeCustomQuestion(question.id)}
            className="text-xxs font-medium text-gray-400 hover:text-red-600"
          >
            Remove
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleSkipQuestion(question.id)}
          className="text-xxs font-medium text-gray-400 hover:text-gray-600"
        >
          {skipped ? 'Unskip' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
