import type { GeneratedQuestion } from './question.types';

export interface CustomQuestionSet {
  /** Deterministic signature derived from the analyzed selection; used as the storage key. */
  selectionSignature: string;
  questions: GeneratedQuestion[];
  updatedAt: number;
}
