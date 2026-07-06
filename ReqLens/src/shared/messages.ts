import type { AnalysisResult } from '@core/types/analysis.types';
import type { CustomQuestionSet } from '@core/types/custom-question.types';
import type { FrameSummary } from '@core/types/figma-node.types';
import type { ResponseSet } from '@core/types/response.types';

/**
 * Typed postMessage protocol between the plugin's main thread (Figma sandbox,
 * has document access, no DOM) and the UI (browser iframe, has DOM, no
 * document access). Keeping this in one file makes the wire contract easy to
 * audit — no other data crosses that boundary.
 */

export interface UiReadyMessage {
  type: 'ui-ready';
}

export interface RequestAnalyzeMessage {
  type: 'analyze-selection';
}

export interface SaveResponsesMessage {
  type: 'save-responses';
  payload: ResponseSet;
}

export interface LoadResponsesMessage {
  type: 'load-responses';
  payload: { selectionSignature: string };
}

export interface SaveCustomQuestionsMessage {
  type: 'save-custom-questions';
  payload: CustomQuestionSet;
}

export interface LoadCustomQuestionsMessage {
  type: 'load-custom-questions';
  payload: { selectionSignature: string };
}

export interface ResizeMessage {
  type: 'resize';
  payload: { width: number; height: number };
}

export type UIToMainMessage =
  | UiReadyMessage
  | RequestAnalyzeMessage
  | SaveResponsesMessage
  | LoadResponsesMessage
  | SaveCustomQuestionsMessage
  | LoadCustomQuestionsMessage
  | ResizeMessage;

export interface SelectionAnalyzedMessage {
  type: 'selection-analyzed';
  payload: {
    selectionSignature: string;
    frames: FrameSummary[];
    analysis: AnalysisResult;
  };
}

export interface SelectionEmptyMessage {
  type: 'selection-empty';
}

export interface SelectionErrorMessage {
  type: 'selection-error';
  payload: { message: string };
}

export interface ResponsesLoadedMessage {
  type: 'responses-loaded';
  payload: { responseSet: ResponseSet | null };
}

export interface ResponsesSavedMessage {
  type: 'responses-saved';
  payload: { selectionSignature: string; savedAt: number };
}

export interface CustomQuestionsLoadedMessage {
  type: 'custom-questions-loaded';
  payload: { customQuestionSet: CustomQuestionSet | null };
}

export interface CustomQuestionsSavedMessage {
  type: 'custom-questions-saved';
  payload: { selectionSignature: string; savedAt: number };
}

export type MainToUIMessage =
  | SelectionAnalyzedMessage
  | SelectionEmptyMessage
  | SelectionErrorMessage
  | ResponsesLoadedMessage
  | ResponsesSavedMessage
  | CustomQuestionsLoadedMessage
  | CustomQuestionsSavedMessage;

/** Figma wraps postMessage payloads in `{ pluginMessage }`; these helpers hide that envelope. */
export function toPluginMessageEnvelope<T>(message: T): { pluginMessage: T } {
  return { pluginMessage: message };
}
