import { create } from 'zustand';
import { generateQuestions } from '@core/services/question-engine.service';
import type { AnalysisResult } from '@core/types/analysis.types';
import type { FrameSummary } from '@core/types/figma-node.types';
import type { GeneratedQuestion, QuestionGroup, QuestionPriority } from '@core/types/question.types';
import type { QuestionResponse } from '@core/types/response.types';
import type { StatusFilter } from '@ui/utils/questionFilters';

function createCustomQuestionId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type ConnectionStatus = 'idle' | 'analyzing' | 'ready' | 'empty' | 'error';
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AppState {
  status: ConnectionStatus;
  errorMessage: string | null;
  selectionSignature: string | null;
  frameSummaries: FrameSummary[];
  analysis: AnalysisResult | null;
  questions: GeneratedQuestion[];
  customQuestions: GeneratedQuestion[];
  customQuestionsDirty: boolean;
  responses: Record<string, QuestionResponse>;
  responsesDirty: boolean;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: number | null;

  questionSearch: string;
  questionStatusFilter: StatusFilter;
  questionGroupFilter: QuestionGroup | 'all';

  setSelectionAnalyzing: () => void;
  setSelectionAnalyzed: (payload: {
    selectionSignature: string;
    frames: FrameSummary[];
    analysis: AnalysisResult;
  }) => void;
  setSelectionEmpty: () => void;
  setSelectionError: (message: string) => void;
  setResponsesLoaded: (responses: Record<string, QuestionResponse>) => void;
  setCustomQuestionsLoaded: (questions: GeneratedQuestion[]) => void;

  answerQuestion: (questionId: string, answer: string) => void;
  toggleSkipQuestion: (questionId: string) => void;
  markSaved: () => void;
  setAutosaveStatus: (status: AutosaveStatus) => void;

  addCustomQuestion: (input: { text: string; group: QuestionGroup; priority: QuestionPriority }) => void;
  removeCustomQuestion: (questionId: string) => void;
  updateCustomQuestionPriority: (questionId: string, priority: QuestionPriority) => void;
  markCustomQuestionsSaved: () => void;

  setQuestionSearch: (value: string) => void;
  setQuestionStatusFilter: (value: StatusFilter) => void;
  setQuestionGroupFilter: (value: QuestionGroup | 'all') => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  status: 'idle',
  errorMessage: null,
  selectionSignature: null,
  frameSummaries: [],
  analysis: null,
  questions: [],
  customQuestions: [],
  customQuestionsDirty: false,
  responses: {},
  responsesDirty: false,
  autosaveStatus: 'idle',
  lastSavedAt: null,

  questionSearch: '',
  questionStatusFilter: 'all',
  questionGroupFilter: 'all',

  setSelectionAnalyzing: () => set({ status: 'analyzing', errorMessage: null }),

  setSelectionAnalyzed: ({ selectionSignature, frames, analysis }) => {
    const questions = generateQuestions(analysis);
    const isSameSelection = get().selectionSignature === selectionSignature;
    set({
      status: 'ready',
      errorMessage: null,
      selectionSignature,
      frameSummaries: frames,
      analysis,
      questions,
      // Re-analysis of the same selection (e.g. after a layer rename) keeps existing
      // answers and custom questions; a genuinely new selection starts clean until
      // any previously saved data for it is loaded back in.
      responses: isSameSelection ? get().responses : {},
      responsesDirty: false,
      customQuestions: isSameSelection ? get().customQuestions : [],
      customQuestionsDirty: false,
    });
  },

  setSelectionEmpty: () =>
    set({
      status: 'empty',
      errorMessage: null,
      analysis: null,
      questions: [],
      customQuestions: [],
      frameSummaries: [],
      selectionSignature: null,
    }),

  setSelectionError: (message) => set({ status: 'error', errorMessage: message }),

  setResponsesLoaded: (responses) => set({ responses, responsesDirty: false }),
  setCustomQuestionsLoaded: (questions) => set({ customQuestions: questions, customQuestionsDirty: false }),

  answerQuestion: (questionId, answer) =>
    set((state) => ({
      responses: {
        ...state.responses,
        [questionId]: { questionId, answer, skipped: false, updatedAt: Date.now() },
      },
      responsesDirty: true,
    })),

  toggleSkipQuestion: (questionId) =>
    set((state) => {
      const existing = state.responses[questionId];
      const skipped = !existing?.skipped;
      return {
        responses: {
          ...state.responses,
          [questionId]: { questionId, answer: existing?.answer ?? '', skipped, updatedAt: Date.now() },
        },
        responsesDirty: true,
      };
    }),

  markSaved: () => set({ responsesDirty: false, lastSavedAt: Date.now(), autosaveStatus: 'saved' }),
  setAutosaveStatus: (status) => set({ autosaveStatus: status }),

  addCustomQuestion: ({ text, group, priority }) =>
    set((state) => {
      const question: GeneratedQuestion = {
        id: createCustomQuestionId(),
        ruleId: 'custom',
        ruleDescription: 'User-added question',
        text,
        group,
        priority,
        category: 'custom',
        componentIds: [],
        frameId: 'custom',
        frameName: 'General',
      };
      return { customQuestions: [question, ...state.customQuestions], customQuestionsDirty: true };
    }),

  removeCustomQuestion: (questionId) =>
    set((state) => {
      const { [questionId]: _removed, ...responses } = state.responses;
      return {
        customQuestions: state.customQuestions.filter((q) => q.id !== questionId),
        customQuestionsDirty: true,
        responses,
        responsesDirty: questionId in state.responses ? true : state.responsesDirty,
      };
    }),

  updateCustomQuestionPriority: (questionId, priority) =>
    set((state) => ({
      customQuestions: state.customQuestions.map((q) => (q.id === questionId ? { ...q, priority } : q)),
      customQuestionsDirty: true,
    })),

  markCustomQuestionsSaved: () => set({ customQuestionsDirty: false, autosaveStatus: 'saved' }),

  setQuestionSearch: (value) => set({ questionSearch: value }),
  setQuestionStatusFilter: (value) => set({ questionStatusFilter: value }),
  setQuestionGroupFilter: (value) => set({ questionGroupFilter: value }),
}));
