import type { GeneratedQuestion, QuestionGroup } from '@core/types/question.types';
import type { QuestionResponse } from '@core/types/response.types';

export type StatusFilter = 'all' | 'answered' | 'unanswered' | 'skipped';

export function questionStatus(
  question: GeneratedQuestion,
  responses: Record<string, QuestionResponse>,
): 'answered' | 'unanswered' | 'skipped' {
  const response = responses[question.id];
  if (!response) return 'unanswered';
  if (response.skipped) return 'skipped';
  return response.answer.trim() ? 'answered' : 'unanswered';
}

export interface QuestionFilterOptions {
  search: string;
  status: StatusFilter;
  group?: QuestionGroup | 'all';
}

export function filterQuestions(
  questions: readonly GeneratedQuestion[],
  responses: Record<string, QuestionResponse>,
  options: QuestionFilterOptions,
): GeneratedQuestion[] {
  const search = options.search.trim().toLowerCase();
  return questions.filter((question) => {
    if (options.group && options.group !== 'all' && question.group !== options.group) return false;
    if (options.status !== 'all' && questionStatus(question, responses) !== options.status) return false;
    if (search && !question.text.toLowerCase().includes(search) && !question.frameName.toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });
}

export interface ProgressStats {
  total: number;
  answered: number;
  skipped: number;
  percentComplete: number;
}

export function computeProgress(
  questions: readonly GeneratedQuestion[],
  responses: Record<string, QuestionResponse>,
): ProgressStats {
  const total = questions.length;
  const answered = questions.filter((q) => questionStatus(q, responses) === 'answered').length;
  const skipped = questions.filter((q) => questionStatus(q, responses) === 'skipped').length;
  const percentComplete = total === 0 ? 0 : Math.round(((answered + skipped) / total) * 100);
  return { total, answered, skipped, percentComplete };
}
