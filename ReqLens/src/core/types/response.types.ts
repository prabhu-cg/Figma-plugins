export interface QuestionResponse {
  questionId: string;
  answer: string;
  skipped: boolean;
  updatedAt: number;
}

export interface ResponseSet {
  /** Deterministic signature derived from the analyzed selection; used as the storage key. */
  selectionSignature: string;
  responses: Record<string, QuestionResponse>;
  updatedAt: number;
}

export function createEmptyResponseSet(selectionSignature: string): ResponseSet {
  return { selectionSignature, responses: {}, updatedAt: Date.now() };
}
