import { useEffect } from 'react';
import { onMainMessage, sendToMain } from '@ui/lib/pluginBridge';
import { useAppStore } from '@ui/store/appStore';

const AUTOSAVE_DEBOUNCE_MS = 800;

/** Wires the main-thread <-> UI message protocol into the Zustand store, including debounced autosave. */
export function usePluginBridge(): void {
  const selectionSignature = useAppStore((s) => s.selectionSignature);
  const responses = useAppStore((s) => s.responses);
  const responsesDirty = useAppStore((s) => s.responsesDirty);
  const customQuestions = useAppStore((s) => s.customQuestions);
  const customQuestionsDirty = useAppStore((s) => s.customQuestionsDirty);

  useEffect(() => {
    const unsubscribe = onMainMessage((message) => {
      const store = useAppStore.getState();
      switch (message.type) {
        case 'selection-analyzed':
          store.setSelectionAnalyzed(message.payload);
          sendToMain({
            type: 'load-responses',
            payload: { selectionSignature: message.payload.selectionSignature },
          });
          sendToMain({
            type: 'load-custom-questions',
            payload: { selectionSignature: message.payload.selectionSignature },
          });
          break;
        case 'selection-empty':
          store.setSelectionEmpty();
          break;
        case 'selection-error':
          store.setSelectionError(message.payload.message);
          break;
        case 'responses-loaded':
          store.setResponsesLoaded(message.payload.responseSet?.responses ?? {});
          break;
        case 'responses-saved':
          store.markSaved();
          break;
        case 'custom-questions-loaded':
          store.setCustomQuestionsLoaded(message.payload.customQuestionSet?.questions ?? []);
          break;
        case 'custom-questions-saved':
          store.markCustomQuestionsSaved();
          break;
      }
    });

    useAppStore.getState().setSelectionAnalyzing();
    sendToMain({ type: 'ui-ready' });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!responsesDirty || !selectionSignature) return;

    useAppStore.getState().setAutosaveStatus('saving');
    const timeout = setTimeout(() => {
      sendToMain({
        type: 'save-responses',
        payload: { selectionSignature, responses, updatedAt: Date.now() },
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [responses, responsesDirty, selectionSignature]);

  useEffect(() => {
    if (!customQuestionsDirty || !selectionSignature) return;

    useAppStore.getState().setAutosaveStatus('saving');
    const timeout = setTimeout(() => {
      sendToMain({
        type: 'save-custom-questions',
        payload: { selectionSignature, questions: customQuestions, updatedAt: Date.now() },
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [customQuestions, customQuestionsDirty, selectionSignature]);
}
