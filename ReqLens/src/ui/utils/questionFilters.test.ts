import { describe, expect, it } from 'vitest';
import type { GeneratedQuestion } from '@core/types/question.types';
import type { QuestionResponse } from '@core/types/response.types';
import { computeProgress, filterQuestions, questionStatus } from './questionFilters';

function makeQuestion(overrides: Partial<GeneratedQuestion> & { id: string }): GeneratedQuestion {
  return {
    ruleId: 'rule',
    ruleDescription: 'desc',
    text: 'Sample question?',
    group: 'functional',
    priority: 'medium',
    category: 'button',
    componentIds: [],
    frameId: 'frame-1',
    frameName: 'Screen',
    ...overrides,
  };
}

describe('questionStatus', () => {
  it('is unanswered when there is no response', () => {
    expect(questionStatus(makeQuestion({ id: 'q1' }), {})).toBe('unanswered');
  });

  it('is skipped when the response is marked skipped', () => {
    const responses: Record<string, QuestionResponse> = { q1: { questionId: 'q1', answer: '', skipped: true, updatedAt: 0 } };
    expect(questionStatus(makeQuestion({ id: 'q1' }), responses)).toBe('skipped');
  });

  it('is answered when there is non-empty answer text', () => {
    const responses: Record<string, QuestionResponse> = { q1: { questionId: 'q1', answer: 'Yes', skipped: false, updatedAt: 0 } };
    expect(questionStatus(makeQuestion({ id: 'q1' }), responses)).toBe('answered');
  });
});

describe('filterQuestions', () => {
  const questions = [
    makeQuestion({ id: 'q1', text: 'What action on click?', group: 'functional', category: 'button' }),
    makeQuestion({ id: 'q2', text: 'Are permissions required?', group: 'security', category: 'button' }),
    makeQuestion({ id: 'q3', text: 'Default sort order?', group: 'functional', category: 'table' }),
  ];

  it('filters by search text', () => {
    const result = filterQuestions(questions, {}, { search: 'permissions', status: 'all' });
    expect(result.map((q) => q.id)).toEqual(['q2']);
  });

  it('filters by status', () => {
    const responses: Record<string, QuestionResponse> = { q1: { questionId: 'q1', answer: 'Done', skipped: false, updatedAt: 0 } };
    const result = filterQuestions(questions, responses, { search: '', status: 'answered' });
    expect(result.map((q) => q.id)).toEqual(['q1']);
  });

  it('filters by group when provided', () => {
    const result = filterQuestions(questions, {}, { search: '', status: 'all', group: 'security' });
    expect(result.map((q) => q.id)).toEqual(['q2']);
  });

  it('does not filter by group when omitted or "all"', () => {
    const result = filterQuestions(questions, {}, { search: '', status: 'all' });
    expect(result.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
  });
});

describe('computeProgress', () => {
  it('computes totals and completion percentage', () => {
    const questions = [makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' }), makeQuestion({ id: 'q3' })];
    const responses: Record<string, QuestionResponse> = {
      q1: { questionId: 'q1', answer: 'Yes', skipped: false, updatedAt: 0 },
      q2: { questionId: 'q2', answer: '', skipped: true, updatedAt: 0 },
    };

    expect(computeProgress(questions, responses)).toEqual({ total: 3, answered: 1, skipped: 1, percentComplete: 67 });
  });
});
